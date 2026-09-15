import type { PermissionState } from '@vuekumi/shared'
import {
  defaultPermissionState,
  exclusiveFlagForState,
  permissionBlocksLicense,
} from '@vuekumi/shared'
import { PhotoEditError } from './photo-edit.js'

export function resolvePermissionState(input: {
  requested?: PermissionState
  exclusiveAvailable?: boolean
  current?: PermissionState
  hasRecognizablePeople: boolean
}): PermissionState {
  if (input.requested) return input.requested
  if (input.exclusiveAvailable === true) return 'exclusive'
  if (input.exclusiveAvailable === false && input.current === 'exclusive') {
    return defaultPermissionState({ hasRecognizablePeople: input.hasRecognizablePeople })
  }
  if (input.current) return input.current
  return defaultPermissionState({
    exclusiveAvailable: input.exclusiveAvailable,
    hasRecognizablePeople: input.hasRecognizablePeople,
  })
}

export function permissionAfterTwoParty(input: {
  current: PermissionState
  exclusiveSold: boolean
  twoPartyCleared: boolean
  hasRecognizablePeople: boolean
}): PermissionState {
  if (!input.hasRecognizablePeople || input.exclusiveSold || input.twoPartyCleared) {
    return input.current
  }
  if (input.current === 'commercial' || input.current === 'exclusive') return 'editorial'
  return input.current
}

export function assertPermissionStateChange(input: {
  next: PermissionState
  current?: PermissionState
  exclusiveSold: boolean
  commercialLocked: boolean
  hasRecognizablePeople: boolean
  twoPartyCleared: boolean
  actor: 'contributor' | 'admin'
}): void {
  if (input.actor === 'contributor') {
    if (input.current === 'agency_protected') {
      if (input.next !== input.current) {
        throw new PhotoEditError('Agency-protected inventory is managed by VueKumi staff')
      }
    } else if (input.next === 'agency_protected') {
      throw new PhotoEditError('Agency-protected inventory is set by VueKumi staff')
    }
  }
  if (input.exclusiveSold && input.next !== 'exclusive') {
    throw new PhotoEditError('An exclusive licence has already been sold for this photograph')
  }
  const changing = !input.current || input.next !== input.current
  if (
    changing
    && input.commercialLocked
    && (input.next === 'commercial' || input.next === 'exclusive')
  ) {
    throw new PhotoEditError('New commercial licensing is frozen while staff review a rights report')
  }
  const wantsCommercialGrant = input.next === 'commercial' || input.next === 'exclusive'
  const soldExclusiveStays = input.exclusiveSold && input.next === 'exclusive'
  if (
    wantsCommercialGrant
    && input.hasRecognizablePeople
    && !input.twoPartyCleared
    && !soldExclusiveStays
  ) {
    throw new PhotoEditError(
      'Photographer and model approval is required before this photograph can be commercially or exclusively licensed',
    )
  }
}

export function nextExclusiveAvailable(state: PermissionState, exclusiveSold: boolean): boolean {
  return exclusiveFlagForState(state, exclusiveSold)
}

export function permissionWriteData(
  state: PermissionState,
  exclusiveSold: boolean,
  restrictionNotes?: string | null,
) {
  return {
    permissionState: state,
    exclusiveAvailable: nextExclusiveAvailable(state, exclusiveSold),
    ...(restrictionNotes !== undefined ? { restrictionNotes } : {}),
  }
}

export function licenseBlockedByPermission(
  state: PermissionState,
  licenseType: string,
): string | undefined {
  return permissionBlocksLicense(state, licenseType)
}

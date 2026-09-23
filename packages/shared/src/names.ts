/** Split a stored display name on the first space. A single word stays the first name. */
export function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  const space = trimmed.indexOf(' ')
  if (space === -1) return { firstName: trimmed, lastName: '' }
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1).trim() }
}

export function joinDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

export class PersonNameError extends Error {
  statusCode = 400
  constructor(message: string) {
    super(message)
    this.name = 'PersonNameError'
  }
}

/**
 * Prefer explicit first and last name. A legacy single `name` is split so older
 * clients and tests keep working. New profile forms send both fields.
 */
export function personNameFrom(input: {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}): { firstName: string; lastName: string; name: string } {
  const first = input.firstName?.trim() ?? ''
  const last = input.lastName?.trim() ?? ''
  if (first || last) {
    if (!first) throw new PersonNameError('First name is required')
    if (!last) throw new PersonNameError('Last name is required')
    if (first.length > 60 || last.length > 60) {
      throw new PersonNameError('First and last name must be 60 characters or fewer')
    }
    return { firstName: first, lastName: last, name: joinDisplayName(first, last) }
  }
  const legacy = input.name?.trim() ?? ''
  if (!legacy) throw new PersonNameError('First and last name are required')
  if (legacy.length > 120) throw new PersonNameError('Name must be 120 characters or fewer')
  const split = splitDisplayName(legacy)
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    name: joinDisplayName(split.firstName, split.lastName) || split.firstName,
  }
}

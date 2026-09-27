-- Homepage sections can be hidden without leaving the arrangement list.

ALTER TABLE "HomeLayout" ADD COLUMN "hidden" TEXT[] DEFAULT ARRAY[]::TEXT[];

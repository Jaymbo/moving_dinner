-- DropIndex
DROP INDEX "scores_user_id_key";

-- AlterTable
ALTER TABLE "feature_requests" ADD COLUMN     "group_id" INTEGER;

-- AlterTable
ALTER TABLE "meetup_matrix" DROP CONSTRAINT "meetup_matrix_pkey",
ADD COLUMN     "group_id" INTEGER NOT NULL,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "meetup_matrix_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "scores" ADD COLUMN     "group_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "meetup_matrix_user_a_id_user_b_id_group_id_key" ON "meetup_matrix"("user_a_id", "user_b_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "scores_user_id_group_id_key" ON "scores"("user_id", "group_id");

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetup_matrix" ADD CONSTRAINT "meetup_matrix_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

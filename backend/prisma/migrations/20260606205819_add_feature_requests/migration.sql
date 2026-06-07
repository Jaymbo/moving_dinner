-- CreateTable
CREATE TABLE "feature_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'low',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

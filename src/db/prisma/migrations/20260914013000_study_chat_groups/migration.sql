-- CreateTable
CREATE TABLE "SubjectChatGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "leader_id" TEXT,
    "max_students" INTEGER NOT NULL DEFAULT 20,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "SubjectChatGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatGroupMember" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "muted_until" TIMESTAMP(3),
    "muted_reason" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "ChatGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChatMessage" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "media_type" TEXT NOT NULL DEFAULT 'NONE',
    "media_metadata" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "flagged_by" TEXT,
    "flagged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectChatGroup_teacher_id_idx" ON "SubjectChatGroup"("teacher_id");

-- CreateIndex
CREATE INDEX "SubjectChatGroup_subject_idx" ON "SubjectChatGroup"("subject");

-- CreateIndex
CREATE INDEX "SubjectChatGroup_deleted_at_idx" ON "SubjectChatGroup"("deleted_at");

-- CreateIndex
CREATE INDEX "ChatGroupMember_group_id_idx" ON "ChatGroupMember"("group_id");

-- CreateIndex
CREATE INDEX "ChatGroupMember_user_id_idx" ON "ChatGroupMember"("user_id");

-- CreateIndex
CREATE INDEX "ChatGroupMember_is_muted_idx" ON "ChatGroupMember"("is_muted");

-- CreateIndex
CREATE UNIQUE INDEX "ChatGroupMember_group_id_user_id_key" ON "ChatGroupMember"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "GroupChatMessage_group_id_idx" ON "GroupChatMessage"("group_id");

-- CreateIndex
CREATE INDEX "GroupChatMessage_sender_id_idx" ON "GroupChatMessage"("sender_id");

-- CreateIndex
CREATE INDEX "GroupChatMessage_created_at_idx" ON "GroupChatMessage"("created_at");

-- CreateIndex
CREATE INDEX "GroupChatMessage_is_deleted_idx" ON "GroupChatMessage"("is_deleted");

-- CreateIndex
CREATE INDEX "GroupChatMessage_is_flagged_idx" ON "GroupChatMessage"("is_flagged");

-- AddForeignKey
ALTER TABLE "SubjectChatGroup" ADD CONSTRAINT "SubjectChatGroup_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectChatGroup" ADD CONSTRAINT "SubjectChatGroup_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatGroupMember" ADD CONSTRAINT "ChatGroupMember_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "SubjectChatGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatGroupMember" ADD CONSTRAINT "ChatGroupMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatMessage" ADD CONSTRAINT "GroupChatMessage_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "SubjectChatGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatMessage" ADD CONSTRAINT "GroupChatMessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

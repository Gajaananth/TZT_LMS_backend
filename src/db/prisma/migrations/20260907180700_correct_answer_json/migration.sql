-- AlterQuestion: Change correctAnswer column from nullable varchar/text to nullable jsonb, preserving existing strings via to_jsonb cast.
ALTER TABLE "Question" ALTER COLUMN "correctAnswer" TYPE jsonb USING CASE WHEN "correctAnswer" IS NULL THEN NULL ELSE to_jsonb("correctAnswer"::text) END;

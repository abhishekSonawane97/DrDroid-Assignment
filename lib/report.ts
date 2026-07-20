import type { SupabaseClient } from "@supabase/supabase-js";

import { db } from "@/db";
import { messages as messagesTable } from "@/db/schema";
import { generateReportPdf } from "@/lib/pdf";

export interface CreateReportParams {
  supabase: SupabaseClient;
  userId: string;
  threadId: string;
  threadTitle: string;
  title: string;
  sections: { heading: string; content: string }[];
  references: string[];
}

export interface CreateReportResult {
  messageId: string;
  path: string;
  signedUrl: string;
  title: string;
}

// Uses the caller's own authenticated Supabase client (not a service-role
// client) so the reports_insert_own RLS policy is actually the thing
// enforcing ownership, not just an app-level convention.
export async function createReport(
  params: CreateReportParams,
): Promise<CreateReportResult> {
  const pdfBytes = await generateReportPdf({
    title: params.title,
    sections: params.sections,
    references: params.references,
    generatedAt: new Date(),
    threadTitle: params.threadTitle,
  });

  const reportId = crypto.randomUUID();
  const path = `${params.userId}/${reportId}.pdf`;

  const { error: uploadError } = await params.supabase.storage
    .from("reports")
    .upload(path, pdfBytes, { contentType: "application/pdf" });

  if (uploadError) {
    throw new Error(`Failed to upload report: ${uploadError.message}`);
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      threadId: params.threadId,
      role: "assistant",
      content: `Generated PDF report: ${params.title}`,
      pdfUrl: path,
    })
    .returning({ id: messagesTable.id });

  const { data: signedData, error: signError } = await params.supabase.storage
    .from("reports")
    .createSignedUrl(path, 3600);

  if (signError || !signedData) {
    throw new Error("Failed to create a signed URL for the report");
  }

  return {
    messageId: message.id,
    path,
    signedUrl: signedData.signedUrl,
    title: params.title,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";
import { CleanupResponse } from "@/lib/types";

export async function GET(req: NextRequest): Promise<NextResponse<CleanupResponse>> {
  return handleCleanup(req);
}

export async function POST(req: NextRequest): Promise<NextResponse<CleanupResponse>> {
  return handleCleanup(req);
}

async function handleCleanup(req: NextRequest): Promise<NextResponse<CleanupResponse>> {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          deletedCount: 0,
          purgedFiles: [],
          timestamp: new Date().toISOString(),
          error: "Supabase is not configured.",
        },
        { status: 503 }
      );
    }

    // Optional authorization check: Vercel Cron header or custom secret
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const keyParam = new URL(req.url).searchParams.get("key");

    if (cronSecret) {
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || keyParam === cronSecret;
      if (!isAuthorized) {
        return NextResponse.json(
          {
            success: false,
            deletedCount: 0,
            purgedFiles: [],
            timestamp: new Date().toISOString(),
            error: "Unauthorized. Invalid or missing CRON_SECRET.",
          },
          { status: 401 }
        );
      }
    }

    const supabase = getServiceSupabase();
    const nowIso = new Date().toISOString();

    // 1. Find all expired records
    const { data: expiredRecords, error: selectError } = await supabase
      .from("files")
      .select("id, file_path, share_code")
      .lt("expires_at", nowIso);

    if (selectError) {
      console.error("Cron select error:", selectError);
      return NextResponse.json(
        {
          success: false,
          deletedCount: 0,
          purgedFiles: [],
          timestamp: nowIso,
          error: selectError.message,
        },
        { status: 500 }
      );
    }

    if (!expiredRecords || expiredRecords.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        purgedFiles: [],
        timestamp: nowIso,
      });
    }

    const filePaths = expiredRecords.map((r) => r.file_path).filter(Boolean);
    const ids = expiredRecords.map((r) => r.id);

    // 2. Remove files from Supabase Storage bucket
    if (filePaths.length > 0) {
      const { error: storageDeleteError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(filePaths);

      if (storageDeleteError) {
        console.error("Cron storage delete error:", storageDeleteError);
      }
    }

    // 3. Delete records from Postgres `files` table
    const { error: dbDeleteError } = await supabase
      .from("files")
      .delete()
      .in("id", ids);

    if (dbDeleteError) {
      console.error("Cron DB delete error:", dbDeleteError);
      return NextResponse.json(
        {
          success: false,
          deletedCount: 0,
          purgedFiles: filePaths,
          timestamp: nowIso,
          error: dbDeleteError.message,
        },
        { status: 500 }
      );
    }

    console.log(`Cron cleanup successfully purged ${filePaths.length} expired files.`);

    return NextResponse.json({
      success: true,
      deletedCount: filePaths.length,
      purgedFiles: filePaths,
      timestamp: nowIso,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Cron cleanup error:", err);
    return NextResponse.json(
      {
        success: false,
        deletedCount: 0,
        purgedFiles: [],
        timestamp: new Date().toISOString(),
        error: message,
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )

  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .is("ai_score", null)
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ids = (data ?? []).map((r) => r.id)

  await Promise.all(ids.map((id) => supabase.functions.invoke("score-listing", { body: { id } })))

  return NextResponse.json({ queued: ids.length })
}

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

  const results = await Promise.all(ids.map(async (id) => {
    const result = await supabase.functions.invoke("score-listing", { body: { id } })
    if (result.error) {
      const body = await (result.error as any).context?.text?.()
      console.error(`invoke error [${id}]:`, result.error.message, body)
    }
    return result
  }))

  return NextResponse.json({ queued: ids.length })
}

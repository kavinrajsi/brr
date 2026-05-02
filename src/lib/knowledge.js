export async function getKnowledgeContext(brandId, supabase) {
  const { data } = await supabase
    .from('brand_knowledge')
    .select('title, content')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true })
  if (!data?.length) return null
  return data.map(d => `## ${d.title}\n${d.content}`).join('\n\n')
}

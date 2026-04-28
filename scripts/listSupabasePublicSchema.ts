/**
 * Lists public schema tables and columns via PostgREST OpenAPI (root /rest/v1/).
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in env.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=... npx tsx scripts/listSupabasePublicSchema.ts
 *
 * Note: supabase.rpc('sql', ...) is not available unless you create that RPC yourself.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

type OpenApiDoc = {
  definitions?: Record<string, { properties?: Record<string, unknown> }>;
  components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
};

function extractSchemas(doc: OpenApiDoc): Record<string, Record<string, unknown>> {
  if (doc.components?.schemas && Object.keys(doc.components.schemas).length > 0) {
    return doc.components.schemas as Record<string, Record<string, unknown>>;
  }
  if (doc.definitions && Object.keys(doc.definitions).length > 0) {
    return doc.definitions as Record<string, Record<string, unknown>>;
  }
  return {};
}

function columnTypeFromProp(prop: unknown): string {
  if (prop == null || typeof prop !== 'object') return 'unknown';
  const p = prop as Record<string, unknown>;
  if (typeof p.type === 'string') {
    const fmt = p.format;
    if (typeof fmt === 'string' && fmt.length > 0) return `${p.type} (${fmt})`;
    return p.type;
  }
  if (Array.isArray(p.type)) return p.type.join(' | ');
  if (p.$ref && typeof p.$ref === 'string') return p.$ref;
  return JSON.stringify(p).slice(0, 80);
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      'Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in the environment.',
    );
    process.exit(1);
  }

  const url = `${SUPABASE_URL}/rest/v1/`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`OpenAPI fetch failed: ${res.status} ${res.statusText}\n${text.slice(0, 2000)}`);
    process.exit(1);
  }

  const doc = (await res.json()) as OpenApiDoc;
  const schemas = extractSchemas(doc);

  const tableNames = Object.keys(schemas)
    .filter((name) => {
      const s = schemas[name];
      const props = (s as { properties?: unknown }).properties;
      return props != null && typeof props === 'object';
    })
    .sort((a, b) => a.localeCompare(b));

  console.log('=== Public tables (from PostgREST OpenAPI) ===\n');
  console.log(`Count: ${tableNames.length}\n`);
  console.log(tableNames.join(', '));
  console.log('\n=== Columns per table ===\n');

  for (const table of tableNames) {
    const props = (schemas[table] as { properties?: Record<string, unknown> }).properties ?? {};
    const cols = Object.keys(props).sort((a, b) => a.localeCompare(b));
    console.log(`--- ${table} (${cols.length} columns) ---`);
    for (const col of cols) {
      console.log(`  ${col}: ${columnTypeFromProp(props[col])}`);
    }
    console.log('');
  }

  const hasPreferences = tableNames.includes('preferences');
  console.log('=== Answers to your questions ===\n');
  console.log(`3. preferences table present: ${hasPreferences ? 'yes' : 'no'}`);

  const profCols = new Set(
    Object.keys((schemas.profiles as { properties?: Record<string, unknown> })?.properties ?? {}),
  );
  const hasEducation = profCols.has('education');
  const hasEducationLevel = profCols.has('education_level');
  console.log(
    `4. profiles: education=${hasEducation ? 'yes' : 'no'}, education_level=${hasEducationLevel ? 'yes' : 'no'}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxffen8X1J9Xq_fr7B-k6YFoWG3MLNQpZjt_VKcRye6u_AfR2CwjcRNGT41ErjbDQLrig/exec";

export async function onRequest(context) {
  const request = context.request;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  try {
    const headers = new Headers();
    headers.set("Content-Type", request.headers.get("Content-Type") || "application/json");
    headers.set("Accept", "application/json");

    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text()
    });

    const responseHeaders = new Headers(upstream.headers);
    for (const [key, value] of Object.entries(corsHeaders())) {
      responseHeaders.set(key, value);
    }
    responseHeaders.set("Cache-Control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: "Cloudflare gagal menghubungi backend GTR-NAMBASO2026."
    }), {
      status: 502,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

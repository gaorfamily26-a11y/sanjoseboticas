
export const config = {
  runtime: 'edge',
};

// URL Permitida para evitar uso indebido del proxy
const ALLOWED_HOST = "mitienda.facturaclic.pe";

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { url, body } = await req.json();

    if (!url || !body) {
      return new Response(JSON.stringify({ error: 'Missing url or body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validación de Seguridad: Solo permite peticiones al dominio de Odoo configurado
    const targetUrl = new URL(url);
    if (targetUrl.hostname !== ALLOWED_HOST) {
      return new Response(JSON.stringify({ error: 'Unauthorized target host' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Accept': 'text/xml',
        'User-Agent': 'Odoo-Operations-Hub/1.0',
      },
      body: body,
    });

    const data = await response.text();
    
    // Si Odoo devuelve un error 404 o similar, pasamos el código
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'text/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: 'Proxy Connection Failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

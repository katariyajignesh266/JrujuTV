import { authorizeWatchViewer } from '@/lib/api/watchAuth';

export async function POST(request: Request) {
  try {
    const auth = await authorizeWatchViewer(request);
    if (!auth.ok) return auth.response;

    const { data, error: rpcError } = await auth.admin.rpc('get_child_watch_channels', {
      p_child_id: auth.childId,
    });

    if (rpcError) {
      return Response.json({ error: rpcError.message }, { status: 500 });
    }

    return Response.json(data ?? { channels: [] });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

// server sent events

type SSEClient = {
  id: string;
  stream: any; // Hono SSE stream
};

const clients: SSEClient[] = [];

export function addClient(stream: any): string {
  const id = crypto.randomUUID();
  clients.push({ id, stream });
  console.log(`SSE client connected: ${id} (total: ${clients.length})`);
  return id;
}

export function removeClient(id: string) {
  const index = clients.findIndex(c => c.id === id);
  if (index !== -1) {
    clients.splice(index, 1);
    console.log(`SSE client disconnected: ${id} (total: ${clients.length})`);
  }
}

export async function broadcast(data: any) {
  const deadClients: string[] = [];

  for (const client of clients) {
    try {
      await client.stream.writeSSE({
        data: JSON.stringify(data),
      });
    } catch (error) {
      console.error(`Failed to send to client ${client.id}:`, error);
      deadClients.push(client.id);
    }
  }

  // Remove dead clients
  deadClients.forEach(id => removeClient(id));
}

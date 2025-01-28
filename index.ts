import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { Database, OPEN_READWRITE, OPEN_CREATE } from 'sqlite3';

const fastify: FastifyInstance = Fastify();
const db = new Database('./hits.db', OPEN_READWRITE | OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});
const incrementHitCount = (endpoint: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO hits (endpoint, hit_count) 
      VALUES (?, 1) 
      ON CONFLICT(endpoint) 
      DO UPDATE SET hit_count = hit_count + 1
    `,
      [endpoint],
      (err) => {
        if (err) {
          console.error('Error updating hit count:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
};

db.run(
  `
  CREATE TABLE IF NOT EXISTS hits (
    endpoint TEXT PRIMARY KEY,
    hit_count INTEGER DEFAULT 0
  )
`,
  (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
      process.exit(1);
    } else {
      console.log('Hits table created or already exists');

      fastify.get('/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
          const hits = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM hits', [], (err, rows) => {
              if (err) {
                console.error('Error fetching hit counts:', err.message);
                return reject(err);
              }
              resolve(rows);
            });
          });
          reply.send(hits);
        } catch (error) {
          reply.status(500).send({ error: 'Error fetching stats' });
        }
      });

      fastify.get('/hit/:endpoint', async (request: FastifyRequest<{ Params: { endpoint: string } }>, reply: FastifyReply) => {
        const endpoint = `/${request.params.endpoint}`;
        try {
          await incrementHitCount(endpoint);
          reply.send({ message: `Hit count for ${endpoint} incremented` });
        } catch (error) {
          reply.status(500).send({ error: 'Error incrementing hit count' });
        }
      });

      const start = async () => {
        try {
          await fastify.listen({ port: 3020 });
          console.log('Server listening on http://localhost:3000');
        } catch (err) {
          console.error('Error starting server:', err);
          process.exit(1);
        }
      };

      start();
    }
  }
);

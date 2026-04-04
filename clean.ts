import { createClient } from "@libsql/client";

const db = createClient({
  url: "file:local.db",
});

async function clean() {
  const rs = await db.execute("DELETE FROM artists WHERE spotify_id = name;");
  console.log("Deleted corrupted artists:", rs.rowsAffected);
}
clean();

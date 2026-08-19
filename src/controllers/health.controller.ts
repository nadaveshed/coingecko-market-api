export async function getHealth() {
  return { status: "ok" };
}

export async function getReady() {
  return { status: "ready" };
}

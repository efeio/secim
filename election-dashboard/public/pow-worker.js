self.onmessage = async function (e) {
  const { challenge, difficulty } = e.data;
  const requiredPrefix = "0".repeat(difficulty);
  let nonce = 0;

  while (true) {
    const input = challenge + nonce.toString();
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (hashHex.startsWith(requiredPrefix)) {
      self.postMessage({ nonce, hash: hashHex });
      return;
    }
    nonce++;

    if (nonce % 10000 === 0) {
      self.postMessage({ progress: nonce });
    }
  }
};

import { castVote, getPollById } from "../src/lib/election";
import { getRegions } from "../src/lib/regions/index";
import crypto from "crypto";

async function main() {
  const args = process.argv.slice(2);
  const pollIdx = args.indexOf("--poll");
  const rateIdx = args.indexOf("--rate");

  if (pollIdx === -1) {
    console.error("Hata: --poll <poll_id> parametresi zorunludur.");
    console.log("Kullanım: npx tsx scripts/seed-votes.ts --poll <poll_id> [--rate <votes_per_second>]");
    process.exit(1);
  }

  const pollId = args[pollIdx + 1];
  if (!pollId) {
    console.error("Hata: Geçersiz poll_id.");
    process.exit(1);
  }

  const poll = await getPollById(pollId);
  if (!poll) {
    console.error(`Hata: '${pollId}' ID'li oylama bulunamadı.`);
    process.exit(1);
  }

  if (poll.status !== "active") {
    console.warn(`Uyarı: Oylama şu an '${poll.status}' durumunda.`);
  }

  let rate = 10;
  if (rateIdx !== -1) {
    const parsedRate = parseInt(args[rateIdx + 1], 10);
    if (!isNaN(parsedRate) && parsedRate > 0) {
      rate = parsedRate;
    }
  }

  const candidates = poll.candidates;
  if (candidates.length === 0) {
    console.error("Hata: Oylamada hiç aday bulunamadı.");
    process.exit(1);
  }

  const regions = await getRegions(poll.country || "tr");
  if (regions.length === 0) {
    console.error("Hata: Bölgeler yüklenemedi.");
    process.exit(1);
  }

  console.log(`Seeding başlatılıyor:`);
  console.log(`- Oylama: ${poll.title} (${poll.id})`);
  console.log(`- Hız: ${rate} oy/saniye`);
  console.log("Durdurmak için Ctrl+C tuşlarına basın.\n");

  const intervalMs = 1000 / rate;
  let totalSeeded = 0;

  const timer = setInterval(async () => {
    try {
      const randomRegion = regions[Math.floor(Math.random() * regions.length)];
      const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
      const fakeDeviceToken = crypto.randomUUID();
      const fakeIp = `fake-ip-${crypto.randomUUID().slice(0, 8)}`;

      await castVote(poll.id, randomCandidate.id, randomRegion.code, fakeDeviceToken, fakeIp);

      totalSeeded++;
      if (totalSeeded % 50 === 0 || rate < 50) {
        process.stdout.write(`\rToplam eklenen oy: ${totalSeeded} | Son eklenen: ${randomRegion.name} -> ${randomCandidate.name}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`\nOy eklenirken hata: ${errorMsg}`);
    }
  }, intervalMs);

  process.on("SIGINT", () => {
    clearInterval(timer);
    console.log(`\n\nSeeding tamamlandı. Toplam ${totalSeeded} yapay oy eklendi.`);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Kritik hata:", err);
  process.exit(1);
});

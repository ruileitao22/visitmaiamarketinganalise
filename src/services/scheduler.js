const cron = require("node-cron");
const { refreshAnalyticsDataJob } = require("./analyticsService");

function startScheduler() {
  const schedule = process.env.DASHBOARD_SYNC_CRON || "0 6 * * *";
  const timezone = process.env.DASHBOARD_SYNC_TZ || "Europe/Lisbon";

  cron.schedule(
    schedule,
    async () => {
      await refreshAnalyticsDataJob();
    },
    { timezone }
  );

  console.log(`[scheduler] ativo com cron '${schedule}' no timezone '${timezone}'.`);

  if ((process.env.RUN_SYNC_ON_BOOT || "true").toLowerCase() === "true") {
    refreshAnalyticsDataJob();
  }
}

module.exports = { startScheduler };

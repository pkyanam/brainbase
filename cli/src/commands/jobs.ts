/**
 * Jobs command — view and manage background jobs.
 */

import { Brainbase } from "brainbase-sdk";
import { GlobalOptions, CliConfig } from "../types.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";
import chalk from "chalk";

export interface JobsOptions extends GlobalOptions {
  status?: string;
  limit?: number;
}

export async function jobsCommand(
  jobIdOrAction: string | undefined,
  config: CliConfig,
  opts: JobsOptions
): Promise<void> {
  try {
    requireApiKey(config);
    const brain = new Brainbase(buildSdkConfig(config, { brainId: opts.brainId }));

    // Single job lookup
    if (jobIdOrAction && /^\d+$/.test(jobIdOrAction)) {
      const job = await brain.getJob(parseInt(jobIdOrAction));
      if (opts.json) { output(job, opts); return; }
      if (!job) { console.log("Job not found."); return; }
      const statusColor = job.status === "completed" ? chalk.green : job.status === "failed" ? chalk.red : chalk.yellow;
      console.log(chalk.bold(`Job #${job.id} — ${job.name}`));
      console.log(`  Status: ${statusColor(job.status)}`);
      if (job.progress !== undefined) console.log(`  Progress: ${job.progress}%`);
      if (job.error) console.log(chalk.red(`  Error: ${job.error}`));
      if (job.result) console.log(`  Result: ${JSON.stringify(job.result).slice(0, 500)}`);
      return;
    }

    // List all jobs
    const jobs = await brain.listJobs({ status: opts.status, limit: opts.limit ?? 20 });
    if (opts.json) { output(jobs, opts); return; }

    if (!jobs || jobs.length === 0) {
      console.log("No jobs found.");
      return;
    }

    console.log(chalk.bold(`Jobs (${jobs.length}):`));
    for (const j of jobs) {
      const statusIcon = j.status === "completed" ? "✓" : j.status === "failed" ? "✗" : j.status === "active" ? "⏳" : "•";
      const statusColor = j.status === "completed" ? chalk.green : j.status === "failed" ? chalk.red : j.status === "active" ? chalk.yellow : chalk.gray;
      console.log(`  ${statusColor(statusIcon)} ${chalk.gray(`#${j.id}`)} ${j.name} ${statusColor(j.status)}`);
    }
  } catch (err) {
    handleError(err, opts);
  }
}

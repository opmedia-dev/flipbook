# External 15-minute refresh scheduler — flipbook

The repository already declares a GitHub Actions `*/15 * * * *` schedule, but
GitHub's own timed events may arrive hours late or be dropped. An independent
scheduler can call **Build and deploy flipbook** without changing the PDF sync
or Duda embeds. GitHub's scheduled trigger remains available as fallback.

**The external scheduler is not active merely because this guide is committed.**

## Configure cron-job.org (or another HTTPS-capable scheduler)

1. Create a **fine-grained personal access token** with GitHub repository
   **Actions: Read and write** permission for only
   `opmedia-dev/flipbook` and `opmedia-dev/whats-on-calender`. Set an
   expiration and keep it private. GitHub may require the usual mandatory
   metadata read permission. Do not add it to the website, an issue or a commit.
2. Create a new job at <https://cron-job.org/> named `Flipbook 15-minute sync`.
3. Set **HTTP POST** and request URL:

   `https://api.github.com/repos/opmedia-dev/flipbook/actions/workflows/deploy.yml/dispatches`

4. Run every **15 minutes**. Prefer UTC minutes **05, 20, 35, 50** if the
   provider supports selected minutes (the What's On job can run at UTC
   **03, 18, 33, 48**).
5. Supply request headers in the service's private settings:

   ```http
   Authorization: Bearer YOUR_RESTRICTED_TOKEN
   Accept: application/vnd.github+json
   X-GitHub-Api-Version: 2026-03-10
   Content-Type: application/json
   ```

6. Set the JSON body:

   ```json
   {"ref":"main","inputs":{"force":"false","source":"external-cron"}}
   ```

7. Run one test. GitHub's API should normally reply **204 No Content**, meaning
   the workflow was queued, **not** that PDF synchronisation succeeded. Check
   <https://github.com/opmedia-dev/flipbook/actions/workflows/deploy.yml> for
   a `workflow_dispatch` run labelled `external-cron`; inspect the steps
   and confirm the job was successful. Enable failure alerts and review the
   service's run history over the first several days.

The externally dispatched workflow sets `SITE_URL` for the existing Drive
fingerprint comparison. If the PDFs are unchanged, the existing build/deploy
condition skips publishing; only changed data is rebuilt. Manual runs and
pushes retain their existing behaviour, and GitHub's native cron remains
enabled as a fallback.

**Security:** cron-job.org is a third-party service entrusted with a restricted
token in its HTTP Authorization header. Do not put a token in a request URL.
If you prefer to keep credentials in a dedicated secret store, use a
Cloudflare Worker Cron Trigger or comparable secret-backed scheduler instead.
Review and renew the GitHub token before expiration; 401/403 responses indicate
an authentication or permission problem.

For the corresponding parish events job, use
`https://api.github.com/repos/opmedia-dev/whats-on-calender/actions/workflows/deploy.yml/dispatches`
with the same body and suitably limited token.

The public countdown is only a **scheduled-time estimate**. Inspect the
external scheduler's history **and** the GitHub workflow's completed runs to
verify actual refresh execution.

References:
- <https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event>
- <https://docs.github.com/en/actions/how-tos/troubleshoot-workflows>
- <https://cron-job.org/EN/>

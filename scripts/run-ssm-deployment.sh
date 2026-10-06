#!/usr/bin/env bash
# ==============================================================================
# Unique Jersey Wholesale (UJW) — SSM Deployment Orchestrator for GitHub Actions
# Triggers AWS Systems Manager Run Command and polls status until terminal state.
# ==============================================================================

set -euo pipefail

INSTANCE_ID="${1:-${UJW_EC2_INSTANCE_ID:-i-04b5a0903d590e029}}"
TARGET_SHA="${2:-${GITHUB_SHA:-}}"
AWS_REGION="${3:-${AWS_REGION:-us-east-1}}"

if [[ -z "$TARGET_SHA" ]]; then
    echo "[ERROR] Target commit SHA is required." >&2
    exit 1
fi

echo "================================================================="
echo "UJW CI/CD — Initiating AWS SSM Deployment"
echo "Target Instance: ${INSTANCE_ID}"
echo "Target Commit SHA: ${TARGET_SHA}"
echo "AWS Region: ${AWS_REGION}"
echo "================================================================="

# Construct parameters JSON file for AWS SSM send-command
PARAMS_FILE=$(mktemp /tmp/ssm-deploy-params.XXXXXX.json 2>/dev/null || mktemp)
cat <<EOF > "$PARAMS_FILE"
{
  "commands": [
    "sudo -u ubuntu -H bash -lc 'cd /var/www/ujw && git checkout -- scripts/deploy-production.sh 2>/dev/null || true && git fetch origin main --tags && if [ -f scripts/deploy-production.sh ]; then bash scripts/deploy-production.sh \"${TARGET_SHA}\"; else git merge --ff-only \"${TARGET_SHA}\" && bash scripts/deploy-production.sh \"${TARGET_SHA}\"; fi'"
  ]
}
EOF

# Send Command via AWS Systems Manager
echo "Dispatching AWS-RunShellScript to ${INSTANCE_ID}..."
SEND_OUTPUT=$(aws ssm send-command \
    --region "${AWS_REGION}" \
    --instance-ids "${INSTANCE_ID}" \
    --document-name "AWS-RunShellScript" \
    --comment "UJW Production Deploy SHA ${TARGET_SHA}" \
    --parameters "file://${PARAMS_FILE}" \
    --output json)

rm -f "$PARAMS_FILE"

COMMAND_ID=$(echo "$SEND_OUTPUT" | jq -r '.Command.CommandId')

if [[ -z "$COMMAND_ID" || "$COMMAND_ID" == "null" ]]; then
    echo "[ERROR] Failed to obtain SSM CommandId from send-command response." >&2
    echo "$SEND_OUTPUT" >&2
    exit 1
fi

echo "SSM Command Dispatched. Command ID: ${COMMAND_ID}"
echo "Polling deployment status on instance ${INSTANCE_ID}..."

MAX_ATTEMPTS=60 # 10 minutes max (10s intervals)
ATTEMPT=0
TERMINAL_STATUS=""

while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
    ATTEMPT=$((ATTEMPT + 1))
    sleep 10

    INVOCATION_OUTPUT=$(aws ssm get-command-invocation \
        --region "${AWS_REGION}" \
        --command-id "${COMMAND_ID}" \
        --instance-id "${INSTANCE_ID}" \
        --output json 2>/dev/null || echo "{}")

    STATUS=$(echo "$INVOCATION_OUTPUT" | jq -r '.Status // empty')

    if [[ -z "$STATUS" ]]; then
        echo "[Attempt ${ATTEMPT}/${MAX_ATTEMPTS}] Waiting for invocation registration (eventual consistency)..."
        continue
    fi

    echo "[Attempt ${ATTEMPT}/${MAX_ATTEMPTS}] Current SSM Status: ${STATUS}"

    case "$STATUS" in
        Success)
            TERMINAL_STATUS="Success"
            echo "================================================================="
            echo "Deployment Output (stdout):"
            echo "$INVOCATION_OUTPUT" | jq -r '.StandardOutputContent // "No standard output recorded."'
            echo "================================================================="
            break
            ;;
        Failed|Cancelled|TimedOut|DeliveryTimedOut|ExecutionTimedOut|Undeliverable|Terminated)
            TERMINAL_STATUS="$STATUS"
            echo "================================================================="
            echo "[ERROR] Deployment terminated with failure status: ${STATUS}"
            echo "Standard Error Output:"
            echo "$INVOCATION_OUTPUT" | jq -r '.StandardErrorContent // "No standard error recorded."'
            echo "Standard Output:"
            echo "$INVOCATION_OUTPUT" | jq -r '.StandardOutputContent // "No standard output recorded."'
            echo "================================================================="
            exit 1
            ;;
        Pending|InProgress|Delayed)
            # In-progress states, continue polling
            ;;
        *)
            echo "Unknown status: ${STATUS}, continuing polling..."
            ;;
    esac
done

if [[ "$TERMINAL_STATUS" != "Success" ]]; then
    echo "[ERROR] SSM deployment timed out after $((MAX_ATTEMPTS * 10)) seconds." >&2
    exit 1
fi

echo "Deployment via SSM completed successfully with status: Success"

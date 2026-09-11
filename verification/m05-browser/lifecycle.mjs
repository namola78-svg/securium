const DEFAULT_GRACEFUL_STOP_TIMEOUT_MS = 2000;
const DEFAULT_FORCE_STOP_TIMEOUT_MS = 1000;

function isTerminated(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function errorText(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function waitForTermination(child, timeoutMs) {
  return new Promise((resolve) => {
    if (isTerminated(child)) {
      resolve({ terminated: true, timed_out: false });
      return;
    }

    let settled = false;
    const finish = (terminated) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      child.removeListener("close", onClose);
      child.removeListener("error", onError);
      resolve({ terminated, timed_out: !terminated });
    };
    const onExit = () => finish(true);
    const onClose = () => finish(true);
    const onError = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);

    child.once("exit", onExit);
    child.once("close", onClose);
    child.once("error", onError);
  });
}

export async function stopOwnedChild(
  child,
  {
    requestStop = (ownedChild) => {
      if (ownedChild.stdin?.writable) ownedChild.stdin.write("STOP\n");
    },
    gracefulStopTimeoutMs = DEFAULT_GRACEFUL_STOP_TIMEOUT_MS,
    forceStopTimeoutMs = DEFAULT_FORCE_STOP_TIMEOUT_MS,
  } = {},
) {
  if (!child) {
    return {
      started: false,
      graceful_requested: false,
      forced: false,
      terminated: true,
      cleanup_error: null,
    };
  }
  if (isTerminated(child)) {
    return {
      started: true,
      graceful_requested: false,
      forced: false,
      terminated: true,
      cleanup_error: null,
    };
  }

  let gracefulRequested = false;
  let cleanupError = null;
  try {
    await requestStop(child);
    gracefulRequested = true;
  } catch (error) {
    cleanupError = `graceful stop: ${errorText(error)}`;
  }

  let termination = await waitForTermination(child, gracefulStopTimeoutMs);
  if (termination.terminated) {
    return {
      started: true,
      graceful_requested: gracefulRequested,
      forced: false,
      terminated: true,
      cleanup_error: cleanupError,
    };
  }

  let forced = false;
  try {
    if (!isTerminated(child)) {
      forced = child.kill();
    }
  } catch (error) {
    cleanupError = cleanupError || `forced stop: ${errorText(error)}`;
  }
  termination = await waitForTermination(child, forceStopTimeoutMs);
  return {
    started: true,
    graceful_requested: gracefulRequested,
    forced,
    terminated: termination.terminated,
    cleanup_error: cleanupError,
  };
}

// Why: shared between the runtime RPC server and the desktop access-link IPC so a failed
// network widen surfaces one consistent recovery message.
export const NETWORK_EXPOSURE_FAILED_GUIDANCE =
  'Could not expose the runtime to the network for pairing. The listener kept serving locally; retry, or choose an unused --port if the LAN bind was refused.'

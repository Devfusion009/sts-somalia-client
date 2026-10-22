/** Maps the stage RPC's raise messages to one plain line. */
export function stageErrorMessage(message: string) {
  if (message.includes("has not been paid")) return "This booking has not been paid yet.";
  if (message.includes("not fully paid")) return "This booking is not fully paid.";
  if (message.includes("pilgrim details incomplete")) return "Pilgrim details are incomplete.";
  if (message.includes("cannot move back")) return "Stages can only move forward.";
  if (message.includes("not found")) return "Booking not found.";
  const status = message.match(/this booking is (\w+)/);
  if (status) return `This booking is ${status[1]}.`;
  if (message.includes("only STS staff")) return "Only STS staff can change the stage.";
  return message.charAt(0).toUpperCase() + message.slice(1);
}

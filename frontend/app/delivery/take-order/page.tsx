"use client";

import { RiderOrderComposer } from "@/components/rider-order-composer";
import { StaffShell, staffToken } from "@/components/staff-shell";

export default function DeliveryTakeOrder() {
  return <StaffShell panel="delivery" title="Take order">
    <RiderOrderComposer token={staffToken()} />
  </StaffShell>;
}

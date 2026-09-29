"use client";

import { useEffect, useRef } from "react";
import { VARGAS } from "../../../lib/astrology/contracts";
import type { WorkspaceController, WorkspaceView } from "../../../lib/local-workspace/controller";
import { isOutdated } from "../../../lib/local-workspace/model";
import { ensureOpenedChart, needsAutomaticChart } from "../../../lib/local-workspace/automatic-chart";

// Calculation lifecycle is independent of the former informational banner.
export function useOpenedChart(controller: WorkspaceController, view: WorkspaceView, active: boolean) {
  const selected = view.data.profiles.find(profile => profile.id === view.data.ui.selectedProfileId);
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (!active || !selected || attempted.current.has(selected.id)) return;
    const existing = view.results.astrology;
    if (existing?.kind === "astrology" && !isOutdated(existing, view.data) && VARGAS.every(varga => existing.result.charts[varga])) {
      attempted.current.add(selected.id);
      return;
    }
    if (!needsAutomaticChart(view)) return;
    // Errors wait for an explicit retry. Opening history never starts a refresh loop.
    attempted.current.add(selected.id);
    void ensureOpenedChart(controller, selected.id);
  }, [active, controller, selected, view]);
}

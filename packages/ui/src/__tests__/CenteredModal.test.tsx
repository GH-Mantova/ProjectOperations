// PR chore/ui-test-runner — sample render test proving the new
// Vitest + jsdom + @testing-library/react harness in @project-ops/ui works.
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CenteredModal } from "../CenteredModal";

afterEach(() => {
  cleanup();
});

describe("CenteredModal", () => {
  it("renders title and children", () => {
    render(
      <CenteredModal title="Pick a discipline" onClose={() => {}}>
        <p>body content</p>
      </CenteredModal>
    );
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Pick a discipline")).toBeTruthy();
    expect(screen.getByText("body content")).toBeTruthy();
  });

  it("calls onClose when Escape is pressed and not busy", () => {
    const onClose = vi.fn();
    render(
      <CenteredModal title="t" onClose={onClose}>
        <span />
      </CenteredModal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape when busy", () => {
    const onClose = vi.fn();
    render(
      <CenteredModal title="t" onClose={onClose} busy>
        <span />
      </CenteredModal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

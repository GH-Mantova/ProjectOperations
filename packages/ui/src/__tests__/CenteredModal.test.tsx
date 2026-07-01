// Render tests for the shared CenteredModal (@project-ops/ui).
// Covers the full behavioural contract: title/subtitle rendering,
// backdrop-click vs body-click, Esc handling (including busy suppression),
// dialog a11y attributes, and custom maxWidth.
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CenteredModal } from "../CenteredModal";

afterEach(() => {
  cleanup();
});

describe("CenteredModal", () => {
  it("renders title and children with dialog a11y attributes", () => {
    render(
      <CenteredModal title="Pick a discipline" onClose={() => {}}>
        <p>body content</p>
      </CenteredModal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByText("Pick a discipline")).toBeTruthy();
    expect(screen.getByText("body content")).toBeTruthy();
  });

  it("renders optional subtitle when provided", () => {
    render(
      <CenteredModal title="t" subtitle="Choose one of the options below" onClose={() => {}}>
        <span />
      </CenteredModal>
    );
    expect(screen.getByText("Choose one of the options below")).toBeTruthy();
  });

  it("does not render a subtitle element when omitted", () => {
    render(
      <CenteredModal title="t" onClose={() => {}}>
        <span data-testid="body" />
      </CenteredModal>
    );
    expect(screen.queryByText(/./, { selector: "p" })).toBeNull();
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <CenteredModal title="t" onClose={onClose} dataTestId="backdrop">
        <span />
      </CenteredModal>
    );
    const backdrop = screen.getByTestId("backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when the modal body is clicked", () => {
    const onClose = vi.fn();
    render(
      <CenteredModal title="t" onClose={onClose}>
        <span data-testid="body">body</span>
      </CenteredModal>
    );
    fireEvent.click(screen.getByTestId("body"));
    expect(onClose).not.toHaveBeenCalled();
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

  it("ignores backdrop click when busy", () => {
    const onClose = vi.fn();
    render(
      <CenteredModal title="t" onClose={onClose} busy dataTestId="backdrop">
        <span />
      </CenteredModal>
    );
    fireEvent.click(screen.getByTestId("backdrop"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies custom maxWidth to the card", () => {
    render(
      <CenteredModal title="t" onClose={() => {}} maxWidth={720} cardClassName="modal-card">
        <span />
      </CenteredModal>
    );
    const card = document.querySelector(".modal-card") as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(card!.style.maxWidth).toBe("720px");
  });
});

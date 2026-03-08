import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { ToolInvocationBadge, getToolLabel } from "../ToolInvocationBadge";

describe("getToolLabel", () => {
  it("returns 'Creating <path>' for str_replace_editor create", () => {
    expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" })).toBe("Creating /App.jsx");
  });

  it("returns 'Editing <path>' for str_replace_editor str_replace", () => {
    expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/components/Card.jsx" })).toBe("Editing /components/Card.jsx");
  });

  it("returns 'Editing <path>' for str_replace_editor insert", () => {
    expect(getToolLabel("str_replace_editor", { command: "insert", path: "/utils/helpers.js" })).toBe("Editing /utils/helpers.js");
  });

  it("returns 'Viewing <path>' for str_replace_editor view", () => {
    expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe("Viewing /App.jsx");
  });

  it("returns 'Undoing edit' for str_replace_editor undo_edit", () => {
    expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })).toBe("Undoing edit");
  });

  it("returns 'Renaming <path>' for file_manager rename", () => {
    expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx", new_path: "/new.jsx" })).toBe("Renaming /old.jsx");
  });

  it("returns 'Deleting <path>' for file_manager delete", () => {
    expect(getToolLabel("file_manager", { command: "delete", path: "/App.jsx" })).toBe("Deleting /App.jsx");
  });

  it("falls back to toolName for unknown tools", () => {
    expect(getToolLabel("some_unknown_tool", {})).toBe("some_unknown_tool");
  });
});

describe("ToolInvocationBadge", () => {
  it("shows the loading indicator when state is 'call'", () => {
    render(<ToolInvocationBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="call" />);
    expect(screen.getByTestId("loading-indicator")).toBeDefined();
    expect(screen.queryByTestId("done-indicator")).toBeNull();
  });

  it("shows the done indicator when state is 'result'", () => {
    render(<ToolInvocationBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="result" />);
    expect(screen.getByTestId("done-indicator")).toBeDefined();
    expect(screen.queryByTestId("loading-indicator")).toBeNull();
  });

  it("renders the user-friendly label", () => {
    render(<ToolInvocationBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="result" />);
    expect(screen.getByText("Creating /App.jsx")).toBeDefined();
  });

  it("renders editing label for file_manager delete", () => {
    render(<ToolInvocationBadge toolName="file_manager" args={{ command: "delete", path: "/App.jsx" }} state="call" />);
    expect(screen.getByText("Deleting /App.jsx")).toBeDefined();
  });
});

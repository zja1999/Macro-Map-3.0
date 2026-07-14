"use client";

import { useEffect, useId, useState } from "react";
import { Avatar, inputCls } from "./ui";

type UserSuggestion = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  goal: string | null;
};

type Props = {
  name: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
  wrapperClassName?: string;
  allowEmail?: boolean;
  resetSignal?: number;
};

function profileDetail(user: UserSuggestion) {
  if (user.bio) return user.bio;
  return user.goal?.replaceAll("_", " ") ?? "View profile";
}

export function UsernameAutocomplete({
  name,
  placeholder = "Username",
  required,
  maxLength = 24,
  className = inputCls,
  wrapperClassName = "",
  allowEmail = false,
  resetSignal,
}: Props) {
  const listId = useId();
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setValue("");
    setSuggestions([]);
    setActiveIndex(-1);
  }, [resetSignal]);

  useEffect(() => {
    const query = value.trim().replace(/^@/, "").toLowerCase();
    if (!focused || (allowEmail && value.includes("@")) || query.length < 2 || !/^[a-z0-9_]+$/.test(query)) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const body = response.ok ? (await response.json()) as { users?: UserSuggestion[] } : {};
        setSuggestions(body.users ?? []);
        setActiveIndex(-1);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [allowEmail, focused, value]);

  const choose = (user: UserSuggestion) => {
    setValue(user.username);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        name={name}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={focused && suggestions.length > 0}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        className={className}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          setValue(event.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (!suggestions.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            choose(suggestions[activeIndex]);
          } else if (event.key === "Escape") {
            setSuggestions([]);
            setActiveIndex(-1);
          }
        }}
      />

      {focused && suggestions.length > 0 && (
        <div id={listId} role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-edge bg-card p-1 shadow-xl">
          {suggestions.map((user, index) => (
            <button
              key={user.userId}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left ${index === activeIndex ? "bg-accent/10" : "hover:bg-surface"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(user)}
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                <span className="block truncate text-xs text-ink-faint">@{user.username} · {profileDetail(user)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

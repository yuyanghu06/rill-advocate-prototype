"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase";
import AvatarCropper from "./AvatarCropper";

// ── Types ─────────────────────────────────────────────────────────────────────

type Block = {
  block_id: string;
  title: string;
  embedded_text: string;
  date_range: string | null;
  helper_urls: string[];
  source_type: string;
};

type Profile = {
  display_name: string | null;
  headline: string | null;
  is_visible: boolean;
  is_recruiter: boolean;
  company_name: string | null;
  avatar_url: string | null;
};

type Props = {
  email: string;
  profile: Profile;
  blocks: Block[];
};

type Tab = "account" | "profile" | "experience";

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusMsg({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null;
  return (
    <p className={`text-xs mt-1 ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>
      {msg.text}
    </p>
  );
}

// ── Account tab ───────────────────────────────────────────────────────────────

function AccountTab({ email }: { email: string }) {
  const [displayName, setDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function saveName() {
    if (!displayName.trim()) return;
    setSaving(true);
    setNameMsg(null);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName }),
    });
    setSaving(false);
    setNameMsg(res.ok ? { text: "Name updated.", ok: true } : { text: "Failed to update.", ok: false });
    if (res.ok) setDisplayName("");
  }

  async function changeEmail() {
    if (!newEmail.trim()) return;
    setSaving(true);
    setEmailMsg(null);
    const { error } = await getBrowserClient().auth.updateUser({ email: newEmail });
    setSaving(false);
    setEmailMsg(
      error
        ? { text: error.message, ok: false }
        : { text: "Confirmation sent to new email.", ok: true }
    );
    if (!error) setNewEmail("");
  }

  async function changePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      setPwMsg({ text: "Passwords don't match.", ok: false });
      return;
    }
    if (newPassword.length < 8) {
      setPwMsg({ text: "Minimum 8 characters.", ok: false });
      return;
    }
    setSaving(true);
    setPwMsg(null);
    const { error } = await getBrowserClient().auth.updateUser({ password: newPassword });
    setSaving(false);
    setPwMsg(
      error
        ? { text: error.message, ok: false }
        : { text: "Password updated.", ok: true }
    );
    if (!error) { setNewPassword(""); setConfirmPassword(""); }
  }

  return (
    <div className="space-y-8 max-w-md">
      {/* Display name */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Display name</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button
            onClick={saveName}
            disabled={saving || !displayName.trim()}
            className="text-sm px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
        <StatusMsg msg={nameMsg} />
      </section>

      {/* Email */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Email</h3>
        <p className="text-xs text-slate-400 mb-3">Current: {email}</p>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="New email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button
            onClick={changeEmail}
            disabled={saving || !newEmail.trim()}
            className="text-sm px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40"
          >
            Update
          </button>
        </div>
        <StatusMsg msg={emailMsg} />
      </section>

      {/* Password */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Change password</h3>
        <div className="space-y-2">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button
            onClick={changePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="text-sm px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40"
          >
            Change password
          </button>
        </div>
        <StatusMsg msg={pwMsg} />
      </section>
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab({ profile }: { profile: Profile }) {
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [companyName, setCompanyName] = useState(profile.company_name ?? "");
  const [isVisible, setIsVisible] = useState(profile.is_visible);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const body: Record<string, unknown> = { headline, is_visible: isVisible };
    if (profile.is_recruiter) body.company_name = companyName;
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setMsg(res.ok ? { text: "Profile updated.", ok: true } : { text: "Failed to save.", ok: false });
  }

  return (
    <div className="space-y-6 max-w-md">
      <AvatarCropper
        displayName={profile.display_name}
        initialAvatarUrl={profile.avatar_url}
        onUploadComplete={() => {}}
      />

      {/* Company name — recruiters only */}
      {profile.is_recruiter && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Company name</h3>
          <p className="text-xs text-slate-400 mb-2">
            Shown on your company card in the candidate Discover feed.
          </p>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </section>
      )}

      {/* Headline */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Headline</h3>
        <p className="text-xs text-slate-400 mb-2">
          {profile.is_recruiter ? "Shown on your company card." : "Shown on your candidate card in Discover search results."}
        </p>
        <textarea
          rows={2}
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Full-stack engineer · React, TypeScript · ex-Stripe"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </section>

      {/* Visibility */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Profile visibility</h3>
        <p className="text-xs text-slate-400 mb-3">
          When hidden, your profile won't appear in recruiter search results.
        </p>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setIsVisible((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isVisible ? "bg-violet-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                isVisible ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
          <span className="text-sm text-slate-700">
            {isVisible ? "Visible to recruiters" : "Hidden from search"}
          </span>
        </label>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="text-sm px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
      <StatusMsg msg={msg} />
    </div>
  );
}

// ── Experience tab ─────────────────────────────────────────────────────────────

type BlockState = Block & { expanded: boolean; saving: boolean; deleted: boolean; msg: { text: string; ok: boolean } | null };

function ExperienceTab({ blocks: initial }: { blocks: Block[] }) {
  const [blocks, setBlocks] = useState<BlockState[]>(
    initial.map((b) => ({ ...b, expanded: false, saving: false, deleted: false, msg: null }))
  );

  function update(blockId: string, patch: Partial<BlockState>) {
    setBlocks((prev) => prev.map((b) => (b.block_id === blockId ? { ...b, ...patch } : b)));
  }

  async function saveBlock(b: BlockState) {
    update(b.block_id, { saving: true, msg: null });
    const res = await fetch(`/api/settings/blocks/${b.block_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: b.title,
        embedded_text: b.embedded_text,
        date_range: b.date_range ?? "",
        helper_urls: b.helper_urls,
      }),
    });
    update(b.block_id, {
      saving: false,
      msg: res.ok
        ? { text: "Saved and re-embedded.", ok: true }
        : { text: "Failed to save.", ok: false },
    });
  }

  async function deleteBlock(blockId: string) {
    if (!confirm("Delete this experience block? This cannot be undone.")) return;
    update(blockId, { saving: true });
    const res = await fetch(`/api/settings/blocks/${blockId}`, { method: "DELETE" });
    if (res.ok) {
      update(blockId, { deleted: true, saving: false });
    } else {
      update(blockId, { saving: false, msg: { text: "Failed to delete.", ok: false } });
    }
  }

  const visible = blocks.filter((b) => !b.deleted);

  if (!visible.length) {
    return (
      <p className="text-sm text-slate-400">
        No experience blocks yet. Complete onboarding to build your profile.
      </p>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {visible.map((b) => (
        <div key={b.block_id} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Block header */}
          <div
            className="flex items-center justify-between px-4 py-3 bg-white cursor-pointer hover:bg-slate-50"
            onClick={() => update(b.block_id, { expanded: !b.expanded })}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{b.title}</p>
              {b.date_range && (
                <p className="text-xs text-slate-400">{b.date_range}</p>
              )}
            </div>
            <span className="text-slate-400 text-xs ml-3 flex-shrink-0">
              {b.expanded ? "▲ collapse" : "▼ edit"}
            </span>
          </div>

          {/* Edit form */}
          {b.expanded && (
            <div className="px-4 pb-4 pt-1 space-y-3 bg-slate-50 border-t border-slate-100">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Title</label>
                <input
                  type="text"
                  value={b.title}
                  onChange={(e) => update(b.block_id, { title: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Description
                  <span className="font-normal text-slate-400 ml-1">— re-embedded on save</span>
                </label>
                <textarea
                  rows={4}
                  value={b.embedded_text}
                  onChange={(e) => update(b.block_id, { embedded_text: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Date range</label>
                <input
                  type="text"
                  value={b.date_range ?? ""}
                  onChange={(e) => update(b.block_id, { date_range: e.target.value })}
                  placeholder="e.g. 2022–2024"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Helper URLs
                  <span className="font-normal text-slate-400 ml-1">— one per line</span>
                </label>
                <textarea
                  rows={3}
                  value={b.helper_urls.join("\n")}
                  onChange={(e) =>
                    update(b.block_id, { helper_urls: e.target.value.split("\n") })
                  }
                  placeholder="https://github.com/..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => saveBlock(b)}
                  disabled={b.saving}
                  className="text-sm px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40"
                >
                  {b.saving ? "Saving…" : "Save block"}
                </button>
                <button
                  onClick={() => deleteBlock(b.block_id)}
                  disabled={b.saving}
                  className="text-sm px-3 py-2 text-red-500 hover:text-red-600 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
              <StatusMsg msg={b.msg} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function SettingsPanel({ email, profile, blocks }: Props) {
  const [tab, setTab] = useState<Tab>("account");

  const tabs: { id: Tab; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "profile", label: "Profile" },
    { id: "experience", label: "Experience" },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Header */}
      <header className="px-6 pt-8 pb-0">
        <h1 className="text-xl font-semibold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your account and profile</p>

        {/* Tab bar */}
        <div className="flex gap-1 mt-6 border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-sm px-4 py-2 -mb-px border-b-2 transition-colors ${
                tab === t.id
                  ? "border-violet-600 text-violet-700 font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab content */}
      <main className="px-6 py-6">
        {tab === "account" && <AccountTab email={email} />}
        {tab === "profile" && <ProfileTab profile={profile} />}
        {tab === "experience" && <ExperienceTab blocks={blocks} />}
      </main>
    </div>
  );
}

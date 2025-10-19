"use client";

import FormModal from "@/components/FormModal";
import { useSession, type Term } from "@/contexts/SessionContext";

const SessionSwitcher = () => {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    canManageSessions,
    canSwitchSessions,
    terms,
    activeTerm,
    setActiveTerm,
    loading,
    error,
    refreshSessions,
  } = useSession();

  if (loading) {
    return <div className="text-xs text-gray-500">Loading sessions…</div>;
  }

  if (error) {
    return <div className="text-xs text-red-500">Unable to load sessions: {error}</div>;
  }

  if (!sessions.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>No academic sessions yet.</span>
        {canManageSessions && (
          <FormModal table="session" type="create" onSuccess={refreshSessions} />
        )}
      </div>
    );
  }

  const handleSessionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveSessionId(event.target.value);
  };

  const handleTermChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveTerm(event.target.value as Term);
  };

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="session-switcher" className="text-xs text-gray-500 hidden md:block">
          Session
        </label>
        <select
          id="session-switcher"
          value={activeSession?.id ?? ""}
          onChange={handleSessionChange}
          disabled={!canSwitchSessions}
          className="ring-[1.5px] ring-gray-300 rounded-md text-xs px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-gray-400"
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="term-switcher" className="text-xs text-gray-500 hidden md:block">
          Term
        </label>
        <select
          id="term-switcher"
          value={activeTerm}
          onChange={handleTermChange}
          className="ring-[1.5px] ring-gray-300 rounded-md text-xs px-3 py-2 bg-white"
        >
          {terms.map((term) => (
            <option key={term} value={term}>
              {term}
            </option>
          ))}
        </select>
      </div>
      {canManageSessions && (
        <FormModal table="session" type="create" onSuccess={refreshSessions} />
      )}
    </div>
  );
};

export default SessionSwitcher;

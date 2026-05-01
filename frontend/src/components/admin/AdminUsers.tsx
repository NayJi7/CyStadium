"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { api, type AdminUser } from "@/lib/api";

export function AdminUsers({ sessionId }: { sessionId: string }) {
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.adminUsers(sessionId).then(setUsers).finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const toggleAdmin = async (user: AdminUser) => {
    setToggling(user.id);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u));
    try {
      await api.adminPatchUser(sessionId, user.id, !user.is_admin);
    } catch {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: user.is_admin } : u));
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="heading-display text-2xl text-white/80">{users.length} utilisateurs</h2>

      {loading ? (
        <div className="space-y-2">
          {[0,1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl border border-white/5 bg-navy-800/50" />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/30">
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3 hidden md:table-cell">Username</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.id} className="bg-navy-900/30 hover:bg-navy-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{u.name}</div>
                    <div className="text-xs text-white/40">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-white/50 text-xs">{u.username}</td>
                  <td className="px-4 py-3">
                    {u.is_admin ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                        <ShieldCheck size={10} /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30">
                        <ShieldOff size={10} /> User
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleAdmin(u)}
                      disabled={toggling === u.id}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        u.is_admin
                          ? "border-red-400/20 text-red-300 hover:border-red-400/40 hover:bg-red-400/5"
                          : "border-cyan-400/20 text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-400/5"
                      }`}
                    >
                      {u.is_admin ? "Retirer admin" : "Passer admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

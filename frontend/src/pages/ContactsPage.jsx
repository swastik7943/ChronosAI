import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Briefcase, Plus, Trash2, Search, UserPlus, Copy, Link2, Mail, X } from 'lucide-react';

export default function ContactsPage({ token }) {
  const [tab, setTab] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showAddMember, setShowAddMember] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchContacts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/contacts`, { headers });
      setContacts(res.data || []);
    } catch (e) { console.error(e); }
  };

  const fetchTeams = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/teams`, { headers });
      setTeams(res.data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchContacts(); fetchTeams(); }, [token]);

  const searchUsers = async (q) => {
    if (!q || q.length < 2) { setUserResults([]); return; }
    try {
      const res = await axios.get(`${API_URL}/api/contacts/users?q=${q}`, { headers });
      setUserResults(res.data || []);
    } catch (e) { setUserResults([]); }
  };

  const addContact = async (email) => {
    try {
      await axios.post(`${API_URL}/api/contacts`, { email }, { headers });
      fetchContacts();
      setShowAddContact(false);
      setAddEmail('');
      setUserResults([]);
    } catch (e) { alert(e.response?.data?.message || 'Failed to add contact'); }
  };

  const deleteContact = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/contacts/${id}`, { headers });
      fetchContacts();
    } catch (e) { console.error(e); }
  };

  const createTeam = async () => {
    if (!teamName.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/api/teams`, { name: teamName, description: teamDesc }, { headers });
      const teamId = res.data._id;
      for (const email of teamMembers) {
        await axios.post(`${API_URL}/api/teams/${teamId}/members`, { email }, { headers }).catch(() => {});
      }
      fetchTeams();
      setShowCreateTeam(false);
      setTeamName('');
      setTeamDesc('');
      setTeamMembers([]);
    } catch (e) { alert(e.response?.data?.message || 'Failed to create workspace'); }
  };

  const deleteTeam = async (id) => {
    if (!confirm('Delete this workspace?')) return;
    try {
      await axios.delete(`${API_URL}/api/teams/${id}`, { headers });
      fetchTeams();
    } catch (e) { alert(e.response?.data?.message || 'Failed to delete'); }
  };

  const addMemberToTeam = async (teamId) => {
    try {
      await axios.post(`${API_URL}/api/teams/${teamId}/members`, { email: memberEmail }, { headers });
      fetchTeams();
      setShowAddMember(null);
      setMemberEmail('');
    } catch (e) { alert(e.response?.data?.message || 'Failed'); }
  };

  const removeMemberFromTeam = async (teamId, userId) => {
    try {
      await axios.delete(`${API_URL}/api/teams/${teamId}/members/${userId}`, { headers });
      fetchTeams();
    } catch (e) { alert(e.response?.data?.message || 'Failed'); }
  };

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredContacts = contacts.filter(c =>
    !searchQuery || c.contactUser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.contactUser?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeams = teams.filter(t =>
    !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contacts & Workspaces</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts · {teams.length} workspaces</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddContact(true)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600 transition-colors shadow-md">
            <UserPlus className="w-3.5 h-3.5" /> Add Contact
          </button>
          <button onClick={() => setShowCreateTeam(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-md">
            <Plus className="w-3.5 h-3.5" /> New Workspace
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button onClick={() => setTab('contacts')} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${tab === 'contacts' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500'}`}>
            <Users className="w-3.5 h-3.5 inline mr-1" /> Contacts
          </button>
          <button onClick={() => setTab('workspaces')} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${tab === 'workspaces' ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500'}`}>
            <Briefcase className="w-3.5 h-3.5 inline mr-1" /> Workspaces
          </button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filter..." className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
        </div>
      </div>

      {/* Contacts Tab */}
      {tab === 'contacts' && (
        <div className="space-y-2">
          {filteredContacts.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              No contacts yet. Add someone!
            </div>
          ) : filteredContacts.map(c => (
            <div key={c._id} className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 hover:border-indigo-500/20 transition-all">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {c.contactUser?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{c.contactUser?.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.contactUser?.email}</p>
              </div>
              {c.contactUser?.timezone && (
                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{c.contactUser.timezone}</span>
              )}
              <button onClick={() => deleteContact(c._id)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Workspaces Tab */}
      {tab === 'workspaces' && (
        <div className="space-y-4">
          {filteredTeams.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
              No workspaces yet. Create one!
            </div>
          ) : filteredTeams.map(t => (
            <div key={t._id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-emerald-500/20 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {t.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{t.name}</h3>
                    <p className="text-[11px] text-gray-400">{t.members?.length} member{t.members?.length !== 1 ? 's' : ''} · Owner: {t.owner?.name || 'You'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => copyInviteCode(t.inviteCode)} title="Copy invite code" className="p-1.5 text-gray-400 hover:text-indigo-400 transition-colors">
                    {copiedCode === t.inviteCode ? <span className="text-xs text-green-400">Copied!</span> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setShowAddMember(showAddMember === t._id ? null : t._id)} className="p-1.5 text-gray-400 hover:text-emerald-400 transition-colors"><UserPlus className="w-4 h-4" /></button>
                  <button onClick={() => deleteTeam(t._id)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Invite code */}
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                <Link2 className="w-3 h-3" /> Invite Code: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-indigo-400">{t.inviteCode}</code>
              </div>

              {/* Members */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {t.members?.map((m, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg text-xs">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold">
                      {m.user?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{m.user?.name || m.user?.email}</span>
                    <span className="text-[10px] text-gray-400">{m.role}</span>
                    {m.role !== 'admin' && (
                      <button onClick={() => removeMemberFromTeam(t._id, m.user?._id)} className="text-gray-400 hover:text-red-400 ml-0.5"><X className="w-3 h-3" /></button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add member inline */}
              {showAddMember === t._id && (
                <div className="flex gap-2 mt-2">
                  <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Member email..." className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                  <button onClick={() => addMemberToTeam(t._id)} className="px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600">Add</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[400px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Add Contact</h3>
              <button onClick={() => { setShowAddContact(false); setAddEmail(''); setUserResults([]); }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <input value={addEmail} onChange={e => { setAddEmail(e.target.value); searchUsers(e.target.value); }} placeholder="Search by name or email..." className="w-full text-sm px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 mb-3" />
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {userResults.map(u => (
                <button key={u._id} onClick={() => addContact(u.email)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm text-left">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">{u.name?.[0]}</div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <Plus className="w-4 h-4 text-indigo-400 ml-auto" />
                </button>
              ))}
              {addEmail.length >= 2 && userResults.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">No users found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[440px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Create Workspace</h3>
              <button onClick={() => { setShowCreateTeam(false); setTeamName(''); setTeamDesc(''); setTeamMembers([]); }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Workspace name..." className="w-full text-sm px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 mb-3" />
            <input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="Description (optional)..." className="w-full text-sm px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 mb-3" />
            <p className="text-xs text-gray-400 mb-2">Add members from contacts:</p>
            <div className="max-h-[150px] overflow-y-auto space-y-1 mb-3">
              {contacts.map(c => {
                const isSelected = teamMembers.includes(c.contactUser?.email);
                return (
                  <button key={c._id} onClick={() => {
                    if (isSelected) setTeamMembers(teamMembers.filter(e => e !== c.contactUser?.email));
                    else setTeamMembers([...teamMembers, c.contactUser?.email]);
                  }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all ${isSelected ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                      {isSelected && '✓'}
                    </div>
                    <span className="text-gray-800 dark:text-gray-200">{c.contactUser?.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{c.contactUser?.email}</span>
                  </button>
                );
              })}
              {contacts.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No contacts to add. Add contacts first!</p>}
            </div>
            <button onClick={createTeam} disabled={!teamName.trim()} className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm">
              Create Workspace {teamMembers.length > 0 && `(${teamMembers.length} members)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

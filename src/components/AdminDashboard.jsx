import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, FileText, Settings, AlertCircle, CheckCircle, XCircle, Search, Filter, ChevronDown, ChevronUp, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLang } from '../contexts/LangContext';

/**
 * Comprehensive Admin Dashboard for managing all features
 * - Listings Management (Approve/Reject/Edit/Delete)
 * - User Management (Roles, Permissions)
 * - Fuel Stations Management
 * - Market Prices Moderation
 * - Edit Suggestions Review
 * - Analytics & Monitoring
 */
export function AdminDashboard() {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState('listings');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Listings Management
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);

  // Users Management
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Edit Suggestions
  const [suggestions, setSuggestions] = useState([]);

  // Fuel Stations
  const [fuelStations, setFuelStations] = useState([]);

  // Analytics
  const [stats, setStats] = useState({
    totalListings: 0,
    pendingListings: 0,
    totalUsers: 0,
    totalFuelStations: 0,
  });

  // Load listings
  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('listings').select('*').order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,name_mm.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Failed to load listings:', error);
    }
    setLoading(false);
  }, [filterStatus, searchTerm]);

  // Load users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
    setLoading(false);
  }, []);

  // Load edit suggestions
  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('edit_suggestions')
        .select('*, listing:listings(id, name, name_mm), suggested_by_user:profiles(id, full_name, nickname)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
    setLoading(false);
  }, []);

  // Load fuel stations
  const loadFuelStations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fuel_stations')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setFuelStations(data || []);
    } catch (error) {
      console.error('Failed to load fuel stations:', error);
    }
    setLoading(false);
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const [listingsRes, usersRes, fuelRes] = await Promise.all([
        supabase.from('listings').select('id', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('fuel_stations').select('id', { count: 'exact' }),
      ]);

      const pendingRes = await supabase.from('listings').select('id', { count: 'exact' }).eq('status', 'pending');

      setStats({
        totalListings: listingsRes.count || 0,
        pendingListings: pendingRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalFuelStations: fuelRes.count || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  // Update listing status
  const updateListingStatus = useCallback(async (listingId, status) => {
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status })
        .eq('id', listingId);

      if (error) throw error;
      loadListings();
    } catch (error) {
      console.error('Failed to update listing:', error);
    }
  }, [loadListings]);

  // Delete listing
  const deleteListing = useCallback(async (listingId) => {
    if (!window.confirm(lang === 'mm' ? 'ဖျက်မည်သည်မှာ သေချာပါသလား?' : 'Are you sure?')) return;

    try {
      const { error } = await supabase.from('listings').delete().eq('id', listingId);
      if (error) throw error;
      loadListings();
    } catch (error) {
      console.error('Failed to delete listing:', error);
    }
  }, [loadListings, lang]);

  // Update user role
  const updateUserRole = useCallback(async (userId, role) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  }, [loadUsers]);

  // Approve suggestion
  const approveSuggestion = useCallback(async (suggestionId, listingId, changes) => {
    try {
      await supabase.from('listings').update(changes).eq('id', listingId);
      await supabase
        .from('edit_suggestions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', suggestionId);
      loadSuggestions();
    } catch (error) {
      console.error('Failed to approve suggestion:', error);
    }
  }, [loadSuggestions]);

  // Reject suggestion
  const rejectSuggestion = useCallback(async (suggestionId) => {
    try {
      await supabase
        .from('edit_suggestions')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', suggestionId);
      loadSuggestions();
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
    }
  }, [loadSuggestions]);

  // Toggle fuel station active status
  const toggleFuelStationStatus = useCallback(async (stationId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('fuel_stations')
        .update({ is_active: !currentStatus })
        .eq('id', stationId);

      if (error) throw error;
      loadFuelStations();
    } catch (error) {
      console.error('Failed to update fuel station:', error);
    }
  }, [loadFuelStations]);

  // Initial load
  useEffect(() => {
    loadStats();
    loadListings();
  }, []);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'listings') loadListings();
    else if (activeTab === 'users') loadUsers();
    else if (activeTab === 'suggestions') loadSuggestions();
    else if (activeTab === 'fuel') loadFuelStations();
  }, [activeTab, loadListings, loadUsers, loadSuggestions, loadFuelStations]);

  const tabs = [
    { id: 'listings', label: lang === 'mm' ? 'လုပ်ငန်းများ' : 'Listings', icon: FileText },
    { id: 'users', label: lang === 'mm' ? 'အသုံးပြုသူများ' : 'Users', icon: Users },
    { id: 'suggestions', label: lang === 'mm' ? 'အကြံပြုချက်များ' : 'Suggestions', icon: AlertCircle },
    { id: 'fuel', label: lang === 'mm' ? 'ဆီဆိုင်များ' : 'Fuel Stations', icon: BarChart3 },
    { id: 'settings', label: lang === 'mm' ? 'ချိန်ညှိမှုများ' : 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0015] to-[#1a0030] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0d0015]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-4">
            {lang === 'mm' ? '🛡️ Admin Panel' : '🛡️ Admin Panel'}
          </h1>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="text-xs text-white/50">{lang === 'mm' ? 'စုစုပေါင်း လုပ်ငန်းများ' : 'Total Listings'}</p>
              <p className="text-xl font-bold text-brand-300">{stats.totalListings}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="text-xs text-white/50">{lang === 'mm' ? 'အတည်ပြုမှီ' : 'Pending'}</p>
              <p className="text-xl font-bold text-yellow-400">{stats.pendingListings}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="text-xs text-white/50">{lang === 'mm' ? 'အသုံးပြုသူများ' : 'Users'}</p>
              <p className="text-xl font-bold text-blue-400">{stats.totalUsers}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="text-xs text-white/50">{lang === 'mm' ? 'ဆီဆိုင်များ' : 'Fuel Stations'}</p>
              <p className="text-xl font-bold text-green-400">{stats.totalFuelStations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-24 z-30 bg-[#0d0015]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-brand-400 text-brand-300'
                    : 'border-transparent text-white/50 hover:text-white/70'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search & Filter */}
        {(activeTab === 'listings' || activeTab === 'users') && (
          <div className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder={lang === 'mm' ? 'ရှာဖွေပါ...' : 'Search...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-brand-400"
              />
            </div>
            {activeTab === 'listings' && (
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-brand-400"
              >
                <option value="all">{lang === 'mm' ? 'အားလုံး' : 'All'}</option>
                <option value="pending">{lang === 'mm' ? 'အတည်ပြုမှီ' : 'Pending'}</option>
                <option value="approved">{lang === 'mm' ? 'အတည်ပြုပြီး' : 'Approved'}</option>
                <option value="rejected">{lang === 'mm' ? 'ငြင်းပယ်ပြီး' : 'Rejected'}</option>
              </select>
            )}
          </div>
        )}

        {/* Listings Tab */}
        {activeTab === 'listings' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-white/50">{lang === 'mm' ? 'ဖွင့်နေသည်...' : 'Loading...'}</div>
            ) : listings.length === 0 ? (
              <div className="text-center py-8 text-white/50">{lang === 'mm' ? 'ရှာဖွေတွေ့ရှိမှု မရှိ' : 'No listings found'}</div>
            ) : (
              listings.map(listing => (
                <div key={listing.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white">{listing.name_mm || listing.name}</p>
                      <p className="text-sm text-white/50">{listing.address}</p>
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          listing.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          listing.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {listing.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {listing.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateListingStatus(listing.id, 'approved')}
                            className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => updateListingStatus(listing.id, 'rejected')}
                            className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteListing(listing.id)}
                        className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-white/50">{lang === 'mm' ? 'ဖွင့်နေသည်...' : 'Loading...'}</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-white/50">{lang === 'mm' ? 'အသုံးပြုသူ မရှိ' : 'No users found'}</div>
            ) : (
              users.map(user => (
                <div key={user.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white">{user.full_name || user.nickname || 'Anonymous'}</p>
                      <p className="text-sm text-white/50">{user.email}</p>
                      <p className="text-xs text-white/40 mt-1">{lang === 'mm' ? 'အခန်းကဏ္ဍ:' : 'Role:'} {user.role || 'user'}</p>
                    </div>
                    <select
                      value={user.role || 'user'}
                      onChange={e => updateUserRole(user.id, e.target.value)}
                      className="px-3 py-1 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-brand-400"
                    >
                      <option value="user">{lang === 'mm' ? 'အသုံးပြုသူ' : 'User'}</option>
                      <option value="moderator">{lang === 'mm' ? 'ကြီးကြပ်သူ' : 'Moderator'}</option>
                      <option value="admin">{lang === 'mm' ? 'အုပ်ချုပ်သူ' : 'Admin'}</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-white/50">{lang === 'mm' ? 'ဖွင့်နေသည်...' : 'Loading...'}</div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8 text-white/50">{lang === 'mm' ? 'အကြံပြုချက် မရှိ' : 'No suggestions'}</div>
            ) : (
              suggestions.map(suggestion => (
                <div key={suggestion.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white">{suggestion.listing?.name_mm || suggestion.listing?.name}</p>
                      <p className="text-sm text-white/50">{lang === 'mm' ? 'အကြံပြုသူ:' : 'Suggested by:'} {suggestion.suggested_by_user?.full_name || suggestion.suggested_by_user?.nickname}</p>
                      <p className="text-xs text-white/40 mt-1">{lang === 'mm' ? 'ပြောင်းလဲမှုများ:' : 'Changes:'} {JSON.stringify(suggestion.changes).substring(0, 50)}...</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveSuggestion(suggestion.id, suggestion.listing_id, suggestion.changes)}
                        className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => rejectSuggestion(suggestion.id)}
                        className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Fuel Stations Tab */}
        {activeTab === 'fuel' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-white/50">{lang === 'mm' ? 'ဖွင့်နေသည်...' : 'Loading...'}</div>
            ) : fuelStations.length === 0 ? (
              <div className="text-center py-8 text-white/50">{lang === 'mm' ? 'ဆီဆိုင် မရှိ' : 'No fuel stations'}</div>
            ) : (
              fuelStations.map(station => (
                <div key={station.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white">{station.name_mm || station.name}</p>
                      <p className="text-sm text-white/50">{station.address}</p>
                      <p className="text-xs text-white/40 mt-1">{lang === 'mm' ? 'အခြေအနေ:' : 'Status:'} {station.is_active ? '✓ Active' : '✗ Inactive'}</p>
                    </div>
                    <button
                      onClick={() => toggleFuelStationStatus(station.id, station.is_active)}
                      className={`p-2 rounded ${station.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}
                    >
                      {station.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <p className="text-white/50">{lang === 'mm' ? 'ချိန်ညှိမှုများ စောင့်ဆိုင်းနေသည်...' : 'Settings coming soon...'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { ImageUploader } from '../components/UI';
import { uploadImage } from '../lib/cloudinary';

export default function SubmitListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useLang();

  // Basic listing form state
  const [form, setForm] = useState({
    name: '',
    name_mm: '',
    category_id: '',
    description: '',
    description_mm: '',
    address: '',
    phone_1: '',
    phone_2: '',
    website: '',
    email: '',
    city: 'Taunggyi',
    township: '',
    map_url: '',
    is_verified: false,
    verify_type: '',
  });

  const [categories, setCategories] = useState([]);
  const [coverImage, setCoverImage] = useState('');
  const [coverLoading, setCoverLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Menu items state
  const [menuItems, setMenuItems] = useState([]);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuFormOpen, setMenuFormOpen] = useState(false);
  const [menuForm, setMenuForm] = useState({
    name: '',
    price: '',
    description: '',
    images: [],
  });
  const [menuImageLoading, setMenuImageLoading] = useState(false);

  // Fetch categories on mount
  useState(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name, name_mm')
        .eq('type', 'directory')
        .eq('is_active', true)
        .order('sort_order');
      setCategories(data || []);
    };
    fetchCategories();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Handle cover image upload
  const handleCoverUpload = async (file) => {
    setCoverLoading(true);
    const url = await uploadImage(file, 'listings/covers');
    setCoverImage(url);
    setCoverLoading(false);
  };

  // Menu image upload (for a single menu item)
  const handleMenuImageUpload = async (file) => {
    setMenuImageLoading(true);
    if (menuForm.images.length >= 5) {
      setError(lang === 'mm' ? 'အများဆုံး ၅ ပုံသာ တင်နိုင်ပါသည်' : 'Maximum 5 images allowed');
      setMenuImageLoading(false);
      return;
    }
    const url = await uploadImage(file, 'menu');
    setMenuForm(prev => ({ ...prev, images: [...prev.images, url] }));
    setMenuImageLoading(false);
  };

  const removeMenuImage = (index) => {
    setMenuForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // Open menu form for new or edit
  const openMenuForm = (item = null) => {
    if (item) {
      setEditingMenuItem(item);
      setMenuForm({
        name: item.name,
        price: item.price,
        description: item.description,
        images: item.images || [],
      });
    } else {
      setEditingMenuItem(null);
      setMenuForm({ name: '', price: '', description: '', images: [] });
    }
    setMenuFormOpen(true);
  };

  const closeMenuForm = () => {
    setMenuFormOpen(false);
    setEditingMenuItem(null);
    setMenuForm({ name: '', price: '', description: '', images: [] });
  };

  const saveMenuItem = () => {
    if (!menuForm.name.trim()) {
      setError(lang === 'mm' ? 'အမည် ထည့်ပါ' : 'Name required');
      return;
    }
    const newItem = {
      id: editingMenuItem?.id || Date.now().toString(),
      name: menuForm.name.trim(),
      price: menuForm.price.trim(),
      description: menuForm.description.trim(),
      images: menuForm.images,
    };
    if (editingMenuItem) {
      setMenuItems(prev => prev.map(item => item.id === editingMenuItem.id ? newItem : item));
    } else {
      setMenuItems(prev => [...prev, newItem]);
    }
    closeMenuForm();
  };

  const deleteMenuItem = (id) => {
    if (confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this item?')) {
      setMenuItems(prev => prev.filter(item => item.id !== id));
    }
  };

  // Submit listing
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name_mm && !form.name) {
      setError(lang === 'mm' ? 'ဆိုင်အမည် ထည့်ပါ' : 'Business name required');
      return;
    }
    if (!form.category_id) {
      setError(lang === 'mm' ? 'Category ရွေးပါ' : 'Select a category');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      name: form.name || form.name_mm,
      name_mm: form.name_mm || form.name,
      category_id: form.category_id,
      description: form.description || null,
      description_mm: form.description_mm || null,
      address: form.address || null,
      phone_1: form.phone_1 || null,
      phone_2: form.phone_2 || null,
      website: form.website || null,
      email: form.email || null,
      city: form.city,
      township: form.township || null,
      map_url: form.map_url || null,
      cover_url: coverImage || null,
      menu_items: menuItems.length > 0 ? menuItems : null, // store menu items as JSON
      submitted_by: user?.id,
      status: 'pending',
      is_verified: false,
      verify_type: null,
    };

    const { error: insertError } = await supabase.from('listings').insert(payload);
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
    } else {
      navigate('/directory?success=true');
    }
  };

  const cityName = lang === 'mm' ? 'တောင်ကြီးမြို့' : 'Taunggyi';

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-display font-bold text-xl text-white">
          {lang === 'mm' ? 'လုပ်ငန်းအသစ်ထည့်မည်' : 'Submit a Business'}
        </h1>
        <p className="text-xs text-white/40 mt-1">
          {lang === 'mm' ? 'သင်၏ လုပ်ငန်းကို မြို့ခံများအား မိတ်ဆက်ပါ' : 'Introduce your business to the community'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Section */}
        <div className="px-4 space-y-4">
          <div className="card-dark p-4 rounded-2xl space-y-3">
            <h2 className="text-sm font-bold text-white/80 font-myanmar">
              {lang === 'mm' ? 'အခြေခံအချက်အလက်' : 'Basic Information'}
            </h2>

            {/* Business Name */}
            <div>
              <label className="block text-xs text-white/50 mb-1 font-myanmar">
                {lang === 'mm' ? 'ဆိုင်အမည် (မြန်မာ)' : 'Business Name (Myanmar)'} *
              </label>
              <input
                value={form.name_mm}
                onChange={e => set('name_mm', e.target.value)}
                className="input-dark w-full font-myanmar"
                placeholder={lang === 'mm' ? 'ဥပမာ: အောင်စိန်ရိပ်သာ' : 'e.g. Aung Sein Restaurant'}
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">
                {lang === 'mm' ? 'ဆိုင်အမည် (အင်္ဂလိပ်)' : 'Business Name (English)'}
              </label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className="input-dark w-full"
                placeholder="e.g. Aung Sein Restaurant"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs text-white/50 mb-1 font-myanmar">
                {lang === 'mm' ? 'အမျိုးအစား' : 'Category'} *
              </label>
              <select
                value={form.category_id}
                onChange={e => set('category_id', e.target.value)}
                className="select-dark w-full"
              >
                <option value="">{lang === 'mm' ? '-- Category ရွေးပါ --' : '-- Select Category --'}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-white/50 mb-1 font-myanmar">
                {lang === 'mm' ? 'ဖော်ပြချက် (မြန်မာ)' : 'Description (Myanmar)'}
              </label>
              <textarea
                value={form.description_mm}
                onChange={e => set('description_mm', e.target.value)}
                rows="3"
                className="input-dark w-full font-myanmar resize-none"
                placeholder={lang === 'mm' ? 'သင့်လုပ်ငန်းအကြောင်း အတိုချုံး ရေးပါ...' : 'Short description about your business...'}
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">
                {lang === 'mm' ? 'ဖော်ပြချက် (အင်္ဂလိပ်)' : 'Description (English)'}
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows="3"
                className="input-dark w-full resize-none"
                placeholder="Description in English (optional)"
              />
            </div>
          </div>

          {/* Contact & Location */}
          <div className="card-dark p-4 rounded-2xl space-y-3">
            <h2 className="text-sm font-bold text-white/80 font-myanmar">
              {lang === 'mm' ? 'ဆက်သွယ်ရန်နှင့် တည်နေရာ' : 'Contact & Location'}
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-white/50 mb-1 font-myanmar">
                  {lang === 'mm' ? 'ဖုန်း (အဓိက)' : 'Phone (Primary)'}
                </label>
                <input
                  value={form.phone_1}
                  onChange={e => set('phone_1', e.target.value)}
                  className="input-dark w-full"
                  placeholder="09-xxx-xxx-xxx"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">
                  {lang === 'mm' ? 'ဖုန်း (အရန်အချက်)' : 'Phone (Secondary)'}
                </label>
                <input
                  value={form.phone_2}
                  onChange={e => set('phone_2', e.target.value)}
                  className="input-dark w-full"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1 font-myanmar">
                {lang === 'mm' ? 'လိပ်စာ' : 'Address'}
              </label>
              <input
                value={form.address}
                onChange={e => set('address', e.target.value)}
                className="input-dark w-full font-myanmar"
                placeholder={lang === 'mm' ? 'လမ်း၊ ရပ်ကွက်၊ မြို့' : 'Street, ward, city'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">
                  {lang === 'mm' ? 'မြို့' : 'City'}
                </label>
                <input
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  className="input-dark w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1 font-myanmar">
                  {lang === 'mm' ? 'မြို့နယ်' : 'Township'}
                </label>
                <input
                  value={form.township}
                  onChange={e => set('township', e.target.value)}
                  className="input-dark w-full font-myanmar"
                  placeholder={lang === 'mm' ? 'ဥပမာ: ပုသိမ်ကြီး' : 'e.g. South Dagon'}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">
                {lang === 'mm' ? 'ဝက်ဘ်ဆိုက် / Facebook' : 'Website / Facebook'}
              </label>
              <input
                value={form.website}
                onChange={e => set('website', e.target.value)}
                className="input-dark w-full"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">Email</label>
              <input
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="input-dark w-full"
                type="email"
                placeholder="business@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">
                {lang === 'mm' ? 'မြေပုံလိပ်စာ (Google Maps)' : 'Map URL (Google Maps)'}
              </label>
              <input
                value={form.map_url}
                onChange={e => set('map_url', e.target.value)}
                className="input-dark w-full"
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>
          </div>

          {/* Cover Image */}
          <div className="card-dark p-4 rounded-2xl space-y-3">
            <h2 className="text-sm font-bold text-white/80 font-myanmar">
              {lang === 'mm' ? 'ကိုယ်စားပြုပုံ' : 'Cover Image'}
            </h2>
            {coverImage ? (
              <div className="relative h-40 rounded-xl overflow-hidden">
                <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage('')}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-lg flex items-center justify-center text-white hover:bg-red-500/70"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <ImageUploader onUpload={handleCoverUpload} loading={coverLoading} label="Cover ပုံတင်ရန်" />
            )}
          </div>

          {/* Menu Items Section */}
          <div className="card-dark p-4 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-white/80 font-myanmar">
                {lang === 'mm' ? 'မီနူး / ဝန်ဆောင်မှုများ' : 'Menu / Services'}
              </h2>
              <button
                type="button"
                onClick={() => openMenuForm()}
                className="text-xs bg-brand-600/30 text-brand-300 px-3 py-1.5 rounded-full flex items-center gap-1"
              >
                <Plus size={12} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add Item'}
              </button>
            </div>

            {menuItems.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-4 font-myanmar">
                {lang === 'mm' ? 'မီနူးစာရင်း မရှိသေးပါ' : 'No menu items added yet'}
              </p>
            ) : (
              <div className="space-y-3">
                {menuItems.map((item, idx) => (
                  <div key={item.id} className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                          {item.price && (
                            <span className="text-xs bg-brand-600/30 text-brand-300 px-2 py-0.5 rounded-full">
                              {item.price} Ks
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-white/50 mt-1 line-clamp-2">{item.description}</p>
                        )}
                        {item.images && item.images.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {item.images.map((img, i) => (
                              <img key={i} src={img} alt="menu" className="w-8 h-8 rounded object-cover" />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openMenuForm(item)}
                          className="p-1.5 text-white/40 hover:text-white"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMenuItem(item.id)}
                          className="p-1.5 text-red-400/70 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm font-myanmar">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50"
          >
            {loading
              ? lang === 'mm' ? 'သိမ်းနေသည်...' : 'Submitting...'
              : lang === 'mm' ? 'လုပ်ငန်းထည့်မည်' : 'Submit Business'}
          </button>
        </div>
      </form>

      {/* Menu Item Modal */}
      {menuFormOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#140020] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="sticky top-0 bg-[#140020] p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-display font-bold text-white">
                {editingMenuItem
                  ? (lang === 'mm' ? 'မီနူးပြင်မည်' : 'Edit Menu Item')
                  : (lang === 'mm' ? 'မီနူးအသစ်ထည့်မည်' : 'Add Menu Item')}
              </h3>
              <button onClick={closeMenuForm} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1 font-myanmar">
                  {lang === 'mm' ? 'အမည်' : 'Item Name'} *
                </label>
                <input
                  value={menuForm.name}
                  onChange={e => setMenuForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-dark w-full"
                  placeholder={lang === 'mm' ? 'ဥပမာ: မုန့်တီ' : 'e.g. Mohinga'}
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">
                  {lang === 'mm' ? 'ဈေးနှုန်း (ကျပ်)' : 'Price (Ks)'}
                </label>
                <input
                  value={menuForm.price}
                  onChange={e => setMenuForm(prev => ({ ...prev, price: e.target.value }))}
                  className="input-dark w-full"
                  placeholder="2000"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1 font-myanmar">
                  {lang === 'mm' ? 'ဖော်ပြချက်' : 'Description'}
                </label>
                <textarea
                  value={menuForm.description}
                  onChange={e => setMenuForm(prev => ({ ...prev, description: e.target.value }))}
                  rows="2"
                  className="input-dark w-full resize-none"
                  placeholder={lang === 'mm' ? 'အနှစ်ချုပ် ဖော်ပြချက်...' : 'Brief description...'}
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1">
                  {lang === 'mm' ? 'ပုံများ (အများဆုံး ၅ ပုံ)' : 'Images (max 5)'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {menuForm.images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/20">
                      <img src={img} alt="menu" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeMenuImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {menuForm.images.length < 5 && (
                    <ImageUploader
                      onUpload={handleMenuImageUpload}
                      loading={menuImageLoading}
                      label="+"
                      className="aspect-square w-full"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveMenuItem}
                  className="flex-1 btn-primary py-2 text-sm"
                >
                  {lang === 'mm' ? 'သိမ်းမည်' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={closeMenuForm}
                  className="flex-1 btn-ghost py-2 text-sm"
                >
                  {lang === 'mm' ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
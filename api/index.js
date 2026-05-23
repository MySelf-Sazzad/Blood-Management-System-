const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
console.log('API file loaded successfully');

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL || 'https://ixccxzgpfgvnquaexgal.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4Y2N4emdwZmd2bnF1YWV4Z2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0Nzk5ODEsImV4cCI6MjA5NTA1NTk4MX0.mGZeVyzg4ASngzbhL7pMj7xPRvceDR9xR4AAlbw57XU';
const supabase = createClient(supabaseUrl, supabaseKey);

// ========== AUTH ==========
app.post('/api/signup', async function(req, res) {
    try {
        var body = req.body;
        if (!body.name || !body.email || !body.phone || !body.password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        if (body.password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const { data: banned } = await supabase.from('banned_emails').select('*').eq('email', body.email);
        if (banned && banned.length > 0) {
            return res.status(403).json({ success: false, message: 'This email has been permanently banned' });
        }

        const { data: existing } = await supabase.from('users').select('*').or('email.eq.' + body.email + ',phone.eq.' + body.phone);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email or phone already exists' });
        }

        const { data: user, error } = await supabase.from('users').insert({ 
            name: body.name, 
            email: body.email, 
            phone: body.phone, 
            password: body.password 
        }).select();
        
        if (error) {
            console.error('Insert Error:', error);
            return res.status(500).json({ success: false, message: 'Database error: ' + error.message });
        }
        
        res.json({ success: true, message: 'Account created successfully', user: user[0] });
    } catch (err) {
        console.error('Signup Crash:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/login', async function(req, res) {
    try {
        var body = req.body;
        if (!body.identifier || !body.password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const { data: users, error } = await supabase.from('users').select('*')
            .or('email.eq.' + body.identifier + ',phone.eq.' + body.identifier)
            .eq('password', body.password);
            
        if (error || !users || users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
        }
        res.json({ success: true, message: 'Login successful', user: users[0] });
    } catch (err) {
        console.error('Login Crash:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/profile', async function(req, res) {
    try {
        const { error } = await supabase.from('users').update({ 
            name: req.body.name, 
            email: req.body.email, 
            phone: req.body.phone, 
            address: req.body.address 
        }).eq('id', req.body.id);
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/password', async function(req, res) {
    try {
        const { data: users } = await supabase.from('users').select('*').eq('id', req.body.id).eq('password', req.body.currentPassword);
        if (!users || users.length === 0) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        
        const { error } = await supabase.from('users').update({ password: req.body.newPassword }).eq('id', req.body.id);
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== ADMIN LOGIN ==========
app.post('/api/admin/login', async function(req, res) {
    try {
        var body = req.body;
        const { data: admins, error } = await supabase.from('admins').select('*').eq('username', body.username).eq('password', body.password);
        if (error || !admins || admins.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }
        res.json({ success: true, message: 'Admin login successful' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== DONORS ==========
app.post('/api/donors', async function(req, res) {
    try {
        var body = req.body;
        
        const { data: user } = await supabase.from('users').select('email').eq('id', body.userId).single();
        if (user) {
            const { data: banned } = await supabase.from('banned_emails').select('*').eq('email', user.email);
            if (banned && banned.length > 0) return res.status(403).json({ success: false, message: 'This account has been permanently banned' });
        }

        const { data: existing } = await supabase.from('donors').select('*').eq('user_id', body.userId);
        if (existing && existing.length > 0) return res.status(400).json({ success: false, message: 'Already registered as a donor' });

        const { error } = await supabase.from('donors').insert({ 
            user_id: body.userId, 
            name: body.name, 
            phone: body.phone, 
            blood_group: body.bloodGroup, 
            location: body.location, 
            last_donation: body.lastDonation || null 
        });
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        
        await supabase.from('users').update({ is_donor_registered: true }).eq('id', body.userId);
        res.json({ success: true, message: 'Donor registration successful' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/donors', async function(req, res) {
    try {
        var blood = req.query.blood;
        var location = req.query.location;
        var query = supabase.from('donors').select('*').eq('is_active', true).eq('is_banned', false);
        if (blood) query = query.eq('blood_group', blood);
        if (location) query = query.ilike('location', `%${location}%`);
        
        const { data: donors, error } = await query;
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, donors: donors || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/donors/all', async function(req, res) {
    try {
        var phone = req.query.phone;
        var blood = req.query.blood;
        var query = supabase.from('donors').select('*').order('id', { ascending: false });
        if (phone) query = query.ilike('phone', `%${phone}%`);
        if (blood) query = query.eq('blood_group', blood);
        
        const { data: donors, error } = await query;
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, donors: donors || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/donors/status', async function(req, res) {
    try {
        const { error } = await supabase.from('donors').update({ is_active: req.body.isActive }).eq('user_id', req.body.userId);
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/donors/donated', async function(req, res) {
    try {
        var cooldownDate = new Date();
        cooldownDate.setDate(cooldownDate.getDate() + 90);
        const { error } = await supabase.from('donors').update({ 
            is_active: false, 
            cooldown_until: cooldownDate.toISOString(), 
            last_donation: new Date().toISOString().split('T')[0] 
        }).eq('user_id', req.body.userId);
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: '90-day cooldown started' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== BLOOD BANKS ==========
app.get('/api/blood-banks', async function(req, res) {
    try {
        const { data: bloodBanks, error } = await supabase.from('blood_banks').select('*');
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, bloodBanks: bloodBanks || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/blood-banks', async function(req, res) {
    try {
        var id = 'bb' + Date.now();
        const { error } = await supabase.from('blood_banks').insert({ id: id, name: req.body.name, address: req.body.address, phone: req.body.phone });
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Blood bank added successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/blood-banks/:id', async function(req, res) {
    try {
        const { error } = await supabase.from('blood_banks').update({ name: req.body.name, address: req.body.address, phone: req.body.phone }).eq('id', req.params.id);
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Blood bank updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/blood-banks/:id', async function(req, res) {
    try {
        const { error } = await supabase.from('blood_banks').delete().eq('id', req.params.id);
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Blood bank removed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== EMERGENCY REQUESTS ==========
app.get('/api/emergency-requests', async function(req, res) {
    try {
        var twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: requests, error } = await supabase.from('emergency_requests').select('*').gte('created_at', twentyFourHoursAgo).order('created_at', { ascending: false });
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, requests: requests || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/emergency-requests', async function(req, res) {
    try {
        var id = 'req_' + Date.now();
        const { error } = await supabase.from('emergency_requests').insert({ id: id, hospital: req.body.hospital, location: req.body.location, blood: req.body.blood, phone: req.body.phone });
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Request posted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== REPORTS ==========
app.get('/api/reports', async function(req, res) {
    try {
        const { data: reports, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, reports: reports || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/reports', async function(req, res) {
    try {
        const { error } = await supabase.from('reports').insert({ 
            donor_id: req.body.donorId, 
            donor_name: req.body.donorName, 
            donor_blood_group: req.body.donorBloodGroup, 
            donor_phone: req.body.donorPhone, 
            donor_location: req.body.donorLocation, 
            reported_by: req.body.reportedBy, 
            reported_by_name: req.body.reportedByName, 
            reason: req.body.reason 
        });
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Report submitted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/reports/:id/ban', async function(req, res) {
    try {
        await supabase.from('reports').update({ status: 'banned' }).eq('id', req.params.id);
        
        const { data: report } = await supabase.from('reports').select('*').eq('id', req.params.id).single();
        if (report && report.donor_id) {
            await supabase.from('donors').update({ is_active: false, is_banned: true }).eq('id', report.donor_id);
            const { data: donor } = await supabase.from('donors').select('user_id').eq('id', report.donor_id).single();
            if (donor) {
                const { data: user } = await supabase.from('users').select('email').eq('id', donor.user_id).single();
                if (user) {
                    await supabase.from('banned_emails').upsert({ email: user.email }, { onConflict: 'email' });
                }
            }
        }
        res.json({ success: true, message: 'Report marked as banned' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/reports/:id/dismiss', async function(req, res) {
    try {
        const { error } = await supabase.from('reports').update({ status: 'dismissed' }).eq('id', req.params.id);
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, message: 'Report dismissed' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== ADMIN DONOR ACTIONS ==========
app.put('/api/donors/:id/ban', async function(req, res) {
    try {
        await supabase.from('donors').update({ is_active: false, is_banned: true }).eq('id', req.params.id);
        
        const { data: donor } = await supabase.from('donors').select('user_id').eq('id', req.params.id).single();
        if (donor) {
            const { data: user } = await supabase.from('users').select('email').eq('id', donor.user_id).single();
            if (user) await supabase.from('banned_emails').upsert({ email: user.email }, { onConflict: 'email' });
        }
        res.json({ success: true, message: 'Donor banned permanently' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/donors/:id', async function(req, res) {
    try {
        const { data: donor } = await supabase.from('donors').select('user_id, name').eq('id', req.params.id).single();
        if (!donor) return res.status(404).json({ success: false, message: 'Donor not found' });

        await supabase.from('donors').delete().eq('id', req.params.id);
        await supabase.from('users').update({ is_donor_registered: false }).eq('id', donor.user_id);
        
        const { data: user } = await supabase.from('users').select('email').eq('id', donor.user_id).single();
        if (user) await supabase.from('removed_donors').insert({ email: user.email, name: donor.name });
        
        res.json({ success: true, message: 'Donor removed. Can re-register after 3 months.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== ADMIN DASHBOARD ==========
app.get('/api/admin/users', async function(req, res) {
    try {
        const { data: users, error } = await supabase.from('users').select('id, name, email, phone, is_donor_registered, created_at').order('id', { ascending: false });
        if (error) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, users: users || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/admin/stats', async function(req, res) {
    try {
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: activeDonors } = await supabase.from('donors').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('is_banned', false);
        const { count: pendingReports } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: bannedUsers } = await supabase.from('banned_emails').select('*', { count: 'exact', head: true });
        
        res.json({ 
            success: true, 
            stats: { 
                totalUsers: totalUsers || 0, 
                activeDonors: activeDonors || 0, 
                pendingReports: pendingReports || 0, 
                bannedUsers: bannedUsers || 0 
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== VERCEL EXPORT (FIXED) ==========
// ভার্সেলে সার্ভারলেস ফাংশন হিসেবে রান করার জন্য সঠিক মেথড
module.exports = app;

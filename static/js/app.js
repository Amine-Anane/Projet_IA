/**
 * AI Image Generator - Application JavaScript
 * Gestion du formulaire, galerie, lightbox, et notifications
 */

// ============================================================
// ÉLÉMENTS DU DOM
// ============================================================
const form = document.getElementById('generateForm');
const promptInput = document.getElementById('prompt');
const negativePromptInput = document.getElementById('negativePrompt');
const btnGenerate = document.getElementById('btnGenerate');
const btnText = btnGenerate.querySelector('.btn-text');
const btnLoading = btnGenerate.querySelector('.btn-loading');
const resultCard = document.getElementById('resultCard');
const resultImage = document.getElementById('resultImage');
const resultPrompt = document.getElementById('resultPrompt');
const downloadBtn = document.getElementById('downloadBtn');
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmpty = document.getElementById('galleryEmpty');
const styleGrid = document.getElementById('styleGrid');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxPrompt = document.getElementById('lightboxPrompt');
const lightboxStyle = document.getElementById('lightboxStyle');
const lightboxDate = document.getElementById('lightboxDate');
const lightboxClose = document.getElementById('lightboxClose');
const toastContainer = document.getElementById('toastContainer');

let selectedStyle = 'default';

// ============================================================
// INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
    setupStyleButtons();
    setupLightbox();
});

// ============================================================
// STYLES ARTISTIQUES
// ============================================================
function setupStyleButtons() {
    const buttons = styleGrid.querySelectorAll('.style-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedStyle = btn.dataset.style;
        });
    });
}

// ============================================================
// GÉNÉRATION D'IMAGE
// ============================================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const prompt = promptInput.value.trim();
    if (!prompt) {
        showToast('Veuillez entrer une description.', 'warning');
        promptInput.focus();
        return;
    }

    // Activer le mode chargement
    setLoading(true);

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                negative_prompt: negativePromptInput.value.trim(),
                style: selectedStyle
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur inconnue');
        }

        // Afficher le résultat
        displayResult(data.image);

        // Recharger la galerie
        loadGallery();

        showToast('✨ Image générée avec succès !', 'success');

    } catch (error) {
        console.error('Erreur:', error);
        showToast(error.message, 'error');
    } finally {
        setLoading(false);
    }
});

function setLoading(loading) {
    btnGenerate.disabled = loading;
    btnText.style.display = loading ? 'none' : 'flex';
    btnLoading.style.display = loading ? 'flex' : 'none';
    promptInput.disabled = loading;
    negativePromptInput.disabled = loading;
}

function displayResult(imageData) {
    resultCard.style.display = 'block';
    resultImage.src = imageData.url + '?t=' + Date.now();
    resultImage.alt = imageData.prompt;
    resultPrompt.textContent = `"${imageData.prompt}" — Style: ${getStyleLabel(imageData.style)}`;
    downloadBtn.href = imageData.url;
    downloadBtn.download = `ai-image-${imageData.id}.png`;

    // Scroll vers le résultat
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Clic sur l'image pour ouvrir le lightbox
    resultImage.onclick = () => openLightbox(imageData);
}

// ============================================================
// GALERIE
// ============================================================
async function loadGallery() {
    try {
        const response = await fetch('/gallery');
        const images = await response.json();

        if (images.length === 0) {
            galleryGrid.innerHTML = '';
            galleryEmpty.style.display = 'block';
            return;
        }

        galleryEmpty.style.display = 'none';
        galleryGrid.innerHTML = images.map(img => createGalleryItem(img)).join('');

        // Ajouter les événements
        galleryGrid.querySelectorAll('.gallery-item').forEach((item, index) => {
            const imgData = images[index];
            
            item.querySelector('.gallery-item-image').addEventListener('click', () => {
                openLightbox(imgData);
            });

            const deleteBtn = item.querySelector('.gallery-btn.delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteImage(imgData.filename);
                });
            }
        });

    } catch (error) {
        console.error('Erreur chargement galerie:', error);
    }
}

function createGalleryItem(img) {
    const date = new Date(img.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
        <div class="gallery-item">
            <img class="gallery-item-image" src="${img.url}" alt="${escapeHtml(img.prompt)}" loading="lazy">
            <div class="gallery-item-overlay">
                <p class="gallery-item-prompt">${escapeHtml(img.prompt)}</p>
                <div class="gallery-item-actions">
                    <a href="${img.url}" download="ai-image-${img.id}.png" class="gallery-btn" onclick="event.stopPropagation()">
                        📥 Sauver
                    </a>
                    <button class="gallery-btn delete">🗑️ Supprimer</button>
                </div>
            </div>
        </div>
    `;
}

async function deleteImage(filename) {
    if (!confirm('Supprimer cette image ?')) return;

    try {
        await fetch(`/gallery/${filename}`, { method: 'DELETE' });
        loadGallery();
        showToast('Image supprimée.', 'success');
    } catch (error) {
        showToast('Erreur lors de la suppression.', 'error');
    }
}

// ============================================================
// LIGHTBOX
// ============================================================
function setupLightbox() {
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
}

function openLightbox(imgData) {
    lightboxImage.src = imgData.url;
    lightboxPrompt.textContent = `"${imgData.prompt}"`;
    lightboxStyle.textContent = `🎨 ${getStyleLabel(imgData.style)}`;
    lightboxDate.textContent = `📅 ${new Date(imgData.created_at).toLocaleDateString('fr-FR')}`;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

// ============================================================
// NOTIFICATIONS TOAST
// ============================================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };

    toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Auto-suppression après 4 secondes
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.4s ease-out forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ============================================================
// UTILITAIRES
// ============================================================
function getStyleLabel(style) {
    const labels = {
        default: 'Défaut',
        realistic: 'Réaliste',
        artistic: 'Artistique',
        anime: 'Anime',
        '3d': '3D Render',
        pixel: 'Pixel Art',
        watercolor: 'Aquarelle'
    };
    return labels[style] || style;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

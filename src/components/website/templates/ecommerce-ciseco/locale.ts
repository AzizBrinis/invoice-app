export type CisecoLocale = "en" | "fr";

export const DEFAULT_CISECO_LOCALE: CisecoLocale = "fr";
export const CISECO_LOCALE_QUERY_PARAM = "lang";
export const CISECO_LOCALE_STORAGE_KEY = "ciseco-locale";
export const CISECO_LOCALE_COOKIE_NAME = "ciseco-locale";

const EXTERNAL_HREF_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

const FRENCH_TRANSLATIONS: Record<string, string> = {
  Language: "Langue",
  Currency: "Devise",
  English: "Anglais",
  Français: "Français",
  "United States": "États-Unis",
  France: "France",
  "Language and currency selector": "Sélecteur de langue et de devise",
  "Selector mode": "Mode de sélection",
  "Close menu": "Fermer le menu",
  "Open menu": "Ouvrir le menu",
  Home: "Accueil",
  Information: "Informations",
  Collections: "Collections",
  Software: "Logiciels",
  Logiciels: "Logiciels",
  "About Us": "À propos",
  Blog: "Blog",
  Contact: "Contact",
  Search: "Rechercher",
  Cart: "Panier",
  Browse: "Explorer",
  Company: "Entreprise",
  Account: "Compte",
  More: "Plus",
  "Sign In": "Connexion",
  "Sign in": "Connexion",
  "Sign Up": "Inscription",
  "Sign up": "Inscription",
  "Create Account": "Créer un compte",
  "Create an account": "Créer un compte",
  Wishlists: "Favoris",
  Wishlist: "Favoris",
  Orders: "Commandes",
  Settings: "Paramètres",
  "Orders history": "Historique des commandes",
  "Change password": "Changer le mot de passe",
  Billing: "Facturation",
  "Review eligible orders and request a company invoice for this month's purchases.":
    "Consultez les commandes éligibles et demandez une facture société pour les achats du mois en cours.",
  "Unable to load billing.": "Impossible de charger la facturation.",
  "Saving request...": "Enregistrement de la demande…",
  "Unable to submit the invoice request.":
    "Impossible d'envoyer la demande de facture.",
  "Invoice ready": "Facture prête",
  "Invoice request received": "Demande de facture reçue",
  "Eligible this month": "Éligible ce mois-ci",
  "Order date": "Date de commande",
  "An invoice has already been issued for this order.":
    "Une facture a déjà été émise pour cette commande.",
  "This invoice request has already been processed.":
    "Cette demande de facture a déjà été traitée.",
  "Your invoice request is on file and will be handled using the confirmed billing details below.":
    "Votre demande de facture a bien été enregistrée et sera traitée avec les coordonnées de facturation confirmées ci-dessous.",
  "Requested on": "Demandée le",
  "Your saved company billing details will be reused. You can confirm or update them before submitting the request.":
    "Vos coordonnées de facturation société enregistrées seront réutilisées. Vous pouvez les confirmer ou les modifier avant d'envoyer la demande.",
  "Company billing details are required before an invoice request can be submitted.":
    "Les coordonnées de facturation société sont requises avant d'envoyer une demande de facture.",
  Deadline: "Date limite",
  "Update request": "Mettre à jour la demande",
  "Request invoice": "Demander une facture",
  "Billing company name": "Raison sociale",
  "VAT number": "Numéro de TVA",
  "Full billing address": "Adresse complète de facturation",
  "Confirm invoice request": "Confirmer la demande de facture",
  "Try again": "Réessayer",
  "No orders available for billing.":
    "Aucune commande disponible pour la facturation.",
  "Your eligible orders will appear here as soon as they are confirmed.":
    "Vos commandes éligibles apparaîtront ici dès qu'elles seront confirmées.",
  "VAT number is required.": "Le numéro de TVA est requis.",
  "Full billing address is required.":
    "L'adresse complète de facturation est requise.",
  "Reusable sections": "Sections réutilisables",
  "Neutral visuals": "Visuels neutres",
  "Fast setup": "Mise en place rapide",
  "Flexible updates": "Mises à jour flexibles",
  "Secure checkout": "Paiement sécurisé",
  "Helpful support": "Support utile",
  "Flexible starter template": "Modèle de départ flexible",
  "👋 About Us.": "👋 À propos de nous.",
  "We're impartial and independent, and every day we create distinctive, world-class programmes and content which inform, educate and entertain millions of people in around the world.":
    "Nous sommes impartiaux et indépendants, et chaque jour nous créons des programmes et des contenus distinctifs de classe mondiale qui informent, éduquent et divertissent des millions de personnes dans le monde.",
  "A neutral homepage for any business":
    "Une page d'accueil neutre pour tout type d'activité",
  "Use this clean starting point to showcase products, services, or content without being locked to a specific niche.":
    "Utilisez cette base claire pour présenter des produits, des services ou du contenu sans être enfermée dans un secteur précis.",
  "Designed to adapt across catalogs, services, and content-led sites":
    "Pensé pour s'adapter aux catalogues, aux services et aux sites éditoriaux",
  "Hero illustration": "Illustration principale",
  "Previous slide": "Diapositive précédente",
  "Next slide": "Diapositive suivante",
  "Previous testimonial": "Témoignage précédent",
  "Next testimonial": "Témoignage suivant",
  "Latest additions": "Dernières nouveautés",
  "Fresh placeholder cards": "Nouvelles cartes de démonstration",
  "A clean set of reusable sample items ready to be replaced with real catalog content.":
    "Un ensemble propre d'éléments réutilisables prêt à être remplacé par le vrai contenu du catalogue.",
  "No items are available yet. Please check back soon.":
    "Aucun article n'est disponible pour le moment. Revenez bientôt.",
  "We could not load the catalog right now. Please refresh the page.":
    "Nous n'avons pas pu charger le catalogue pour le moment. Actualisez la page.",
  "A clean and adaptable starting point for catalog, service, or content-driven websites.":
    "Un point de départ clair et adaptable pour des sites catalogue, services ou contenus.",
  "Content page": "Page de contenu",
  "Reading page": "Page de lecture",
  "Table of contents": "Table des matières",
  "Need help?": "Besoin d'aide ?",
  "Speak with": "Parlez avec",
  "For order questions, delivery details, payments or support, contact the store directly.":
    "Pour toute question sur une commande, la livraison, le paiement ou l'assistance, contactez directement la boutique.",
  "Contact us": "Contactez-nous",
  "About us": "À propos",
  "All rights reserved.": "Tous droits réservés.",
  "My Account": "Mon compte",
  "My Orders": "Mes commandes",
  Help: "Aide",
  "Log out": "Déconnexion",
  "Account menu": "Menu du compte",
  "View details": "Voir les détails",
  Founder: "Fondateur",
  "Fast Facts": "Chiffres clés",
  "We're impartial and independent, and every day we create distinctive, world-class programmes and content.":
    "Nous sommes impartiaux et indépendants, et chaque jour nous créons des programmes et des contenus distinctifs de classe mondiale.",
  "Articles have been public around the world (as of Sept. 30, 2025).":
    "Des articles ont été publiés dans le monde entier (au 30 septembre 2025).",
  "Registered users account and active users (as of Sept. 30, 2025).":
    "Des comptes utilisateurs enregistrés et actifs (au 30 septembre 2025).",
  "Countries and regions have our presence (as of Sept. 30, 2025).":
    "Des pays et régions où nous sommes présents (au 30 septembre 2025).",
  "Co-founder and Chief Executive": "Cofondateur et directeur général",
  "Co-founder, Chairman": "Cofondateur, président",
  "Co-founder, Chief Strategy Officer":
    "Cofondateur, directeur de la stratégie",
  "Good news from far away 🥳": "Des bonnes nouvelles venues de loin 🥳",
  "Let's see what people think of Ciseco":
    "Voyons ce que les gens pensent de Ciseco",
  "Great quality products, affordable prices, fast and friendly delivery. I very recommend.":
    "Des produits de grande qualité, des prix accessibles, une livraison rapide et sympathique. Je recommande vivement.",
  "Earn free money with Ciseco.": "Économisez avec Ciseco.",
  "With Ciseco you will get freeship & savings combo.":
    "Avec Ciseco, vous profitez de la livraison offerte et d'un pack économies.",
  "About gallery": "Galerie à propos",
  Added: "Ajouté",
  "Add to cart": "Ajouter au panier",
  "Add to wishlist": "Ajouter aux favoris",
  New: "Nouveau",
  Featured: "À la une",
  Popular: "Populaire",
  Sale: "Promo",
  Hot: "Tendance",
  Workspace: "Espace de travail",
  Planning: "Planification",
  Analytics: "Analytique",
  Operations: "Opérations",
  Support: "Support",
  Resources: "Ressources",
  "Starter Workspace": "Espace de travail de démarrage",
  "Project Brief Kit": "Kit de brief projet",
  "Insight Dashboard": "Tableau de bord d'analyse",
  "Operations Board": "Tableau des opérations",
  "Support Playbook": "Guide support",
  "Collaboration Canvas": "Canvas de collaboration",
  "Roadmap Outline": "Trame de feuille de route",
  "Reporting Snapshot": "Instantané de reporting",
  "Workflow Bundle": "Pack workflow",
  "Help Center Pack": "Pack centre d'aide",
  "Resource Library": "Bibliothèque de ressources",
  "Checklist Archive": "Archive de checklists",
  "Shopping Cart": "Panier",
  "Close cart": "Fermer le panier",
  "Loading cart...": "Chargement du panier...",
  "Your cart is empty": "Votre panier est vide",
  "Add items to see them here and start checkout.":
    "Ajoutez des articles pour les voir ici et commencer le paiement.",
  Quantity: "Quantité",
  Remove: "Retirer",
  Subtotal: "Sous-total",
  "Shipping and taxes calculated at checkout.":
    "Livraison et taxes calculées au paiement.",
  "View cart": "Voir le panier",
  "Check out": "Paiement",
  Checkout: "Paiement",
  "CONTINUE SHOPPING": "CONTINUER LES ACHATS",
  "or CONTINUE SHOPPING →": "ou CONTINUER LES ACHATS →",
  "Some items could not be priced. Remove them to continue.":
    "Le prix de certains articles est indisponible. Retirez-les pour continuer.",
  Standard: "Standard",
  "One size": "Taille unique",
  Item: "Article",
  "CONTACT INFORMATION": "INFORMATIONS DE CONTACT",
  "SHIPPING ADDRESS": "ADRESSE DE LIVRAISON",
  "PAYMENT METHOD": "MODE DE PAIEMENT",
  "Add contact details": "Ajoutez vos coordonnées",
  "Add shipping address": "Ajoutez une adresse de livraison",
  "Choose payment method": "Choisissez un mode de paiement",
  Change: "Modifier",
  Continue: "Continuer",
  Cancel: "Annuler",
  Back: "Retour",
  OR: "OU",
  Email: "E-mail",
  "Email address": "Adresse e-mail",
  Password: "Mot de passe",
  Phone: "Téléphone",
  "First name": "Prénom",
  "Last name": "Nom",
  Address: "Adresse",
  "Apt, Suite *": "App., suite *",
  City: "Ville",
  Country: "Pays",
  "State/Province": "État / province",
  "Postal code": "Code postal",
  "Address type": "Type d'adresse",
  Office: "Bureau",
  Canada: "Canada",
  Tunisia: "Tunisie",
  "Save this information for next time": "Enregistrer ces informations pour la prochaine fois",
  "By proceeding, you agree to our": "En poursuivant, vous acceptez nos",
  and: "et",
  "information": "informations",
  "Discount code": "Code promo",
  "Order summary": "Récapitulatif",
  "Shipping estimate": "Estimation de livraison",
  "Tax estimate": "Estimation des taxes",
  "Order total": "Total de la commande",
  "Questions fréquentes": "Questions fréquentes",
  "Réponses utiles pour mieux choisir ce produit avant achat ou demande de devis.":
    "Réponses utiles pour mieux choisir ce produit avant achat ou demande de devis.",
  Price: "Prix",
  "Price on request": "Prix sur demande",
  "General": "Général",
  Clear: "Effacer",
  Breadcrumb: "Fil d'Ariane",
  "Search products, collections, or categories":
    "Rechercher des produits, des collections ou des catégories",
  "Search catalogue": "Rechercher dans le catalogue",
  "Browse the shop to add items and start checkout.":
    "Parcourez la boutique pour ajouter des articles et commencer le paiement.",
  "Browse the shop to add items before checkout.":
    "Parcourez la boutique pour ajouter des articles avant le paiement.",
  "Back to shop": "Retour à la boutique",
  "Preparing summary...": "Préparation du récapitulatif...",
  "Loading checkout...": "Chargement du paiement...",
  "Loading...": "Chargement...",
  "Submitting...": "Envoi en cours...",
  "(All Day Delivery)": "(Livraison toute la journée)",
  "(Delivery 9 AM - 5 PM)": "(Livraison de 9 h à 17 h)",
  "Debit / Credit Card": "Carte bancaire",
  "Internet banking": "Virement bancaire",
  "Google / Apple Wallet": "Portefeuille Google / Apple",
  "Email is required.": "L'adresse e-mail est obligatoire.",
  "Enter a valid email address.": "Saisissez une adresse e-mail valide.",
  "First name is required.": "Le prénom est obligatoire.",
  "Last name is required.": "Le nom est obligatoire.",
  "Phone number is required.": "Le numéro de téléphone est obligatoire.",
  "Please accept the terms.": "Veuillez accepter les conditions.",
  "Please check the highlighted fields.":
    "Veuillez vérifier les champs mis en évidence.",
  "Select a payment method.": "Sélectionnez un mode de paiement.",
  "Select a valid payment method.":
    "Sélectionnez un mode de paiement valide.",
  "Unable to launch payment. Please try again.":
    "Impossible de lancer le paiement. Réessayez.",
  "Unable to submit your order right now.":
    "Impossible d'envoyer votre commande pour le moment.",
  "Decrease quantity": "Diminuer la quantité",
  "Increase quantity": "Augmenter la quantité",
  "Learn more": "En savoir plus",
  Taxes: "Taxes",
  Shipping: "Livraison",
  "Contact information": "Informations de contact",
  "Do not have an account?": "Vous n'avez pas de compte ?",
  "Log in": "Se connecter",
  "Your phone number": "Votre numéro de téléphone",
  "+808 xxx": "+216 xxx",
  "you@example.com": "vous@exemple.com",
  "Email me news and offers": "Envoyez-moi les nouveautés et les offres",
  "Next to shipping address": "Continuer vers l'adresse de livraison",
  Cole: "Cole",
  Enrico: "Enrico",
  "123, Dream Avenue, USA": "123, avenue des Rêves, États-Unis",
  "55U - DD5": "55U - DD5",
  Norris: "Norris",
  Texas: "Texas",
  "Details coming soon.": "Détails à venir.",
  "Next to payment method": "Continuer vers le mode de paiement",
  "Back to shipping address": "Retour à l'adresse de livraison",
  "Customer": "Client",
  "Bank name": "Nom de la banque",
  "Example Bank Name": "Nom de banque exemple",
  "Account number": "Numéro de compte",
  "Sort code": "Code guichet",
  "Your order will be delivered to you after you transfer to":
    "Votre commande sera livrée après votre virement vers",
  "I agree to the": "J'accepte les",
  "terms and conditions": "conditions générales",
  Apply: "Appliquer",
  "Your cart is empty.": "Votre panier est vide.",
  "Add to bag": "Ajouter au panier",
  "Toggle wishlist": "Basculer les favoris",
  "Remove from wishlist": "Retirer des favoris",
  "Chosen by experts.": "Choisi par les experts.",
  "Featured of the week": "Sélection de la semaine",
  thumbnail: "miniature",
  Categories: "Catégories",
  "All collections": "Toutes les collections",
  Colors: "Couleurs",
  Sizes: "Tailles",
  "Price range": "Plage de prix",
  "Min price": "Prix min",
  "Max price": "Prix max",
  "Sort by": "Trier par",
  "Showing filtered products": "Produits filtrés affichés",
  "Refine the catalog view": "Affinez la vue du catalogue",
  "Earn free money with": "Économisez avec",
  With: "Avec",
  "you will get free shipping & savings combo.":
    "vous profitez de la livraison gratuite et d'un pack d'économies.",
  "Savings combo": "Pack économies",
  "Discover more": "Découvrir plus",
  "Ciseco rewards illustration": "Illustration des avantages Ciseco",
  "More discovery cards": "Plus de cartes découverte",
  Explore: "Explorer",
  "No items match this filter yet.":
    "Aucun article ne correspond encore à ce filtre.",
  Open: "Ouvrir",
  "Adaptable blocks for a clean start":
    "Blocs adaptables pour un départ propre",
  "Neutral placeholder content keeps the layout reusable across industries.":
    "Un contenu neutre garde la mise en page réutilisable dans tous les secteurs.",
  "Start exploring": "Commencez à explorer",
  "Browse key categories": "Parcourez les catégories clés",
  "A neutral category grid for products, services, or content.":
    "Une grille neutre pour des produits, des services ou du contenu.",
  Category: "Catégorie",
  "24+ entries": "24+ entrées",
  "Browse sections": "Parcourir les sections",
  "Explore example groupings": "Explorer des regroupements exemples",
  "Organize content into flexible groups that work for any business.":
    "Organisez le contenu en groupes flexibles adaptés à toute activité.",
  Department: "Rubrique",
  "Flexible callout": "Mise en avant flexible",
  "Built for a wide range of use cases":
    "Conçu pour un large éventail d'usages",
  "Use this banner to highlight a feature, offer, announcement, or supporting message with neutral placeholder content.":
    "Utilisez cette bannière pour mettre en avant une fonctionnalité, une offre, une annonce ou un message d'appui avec un contenu neutre.",
  "Promotional illustration": "Illustration promotionnelle",
  "Stories, notes, and ideas": "Histoires, notes et idées",
  "Use this area for announcements, guides, or editorial content.":
    "Utilisez cette zone pour des annonces, des guides ou du contenu éditorial.",
  Journal: "Journal",
  "Latest articles": "Derniers articles",
  "Blog post": "Article de blog",
  Story: "Histoire",
  "What people are saying": "Ce qu'en disent les gens",
  "People love our products": "Les gens adorent nos produits",
  "Neutral testimonials make it easy to preview social proof placement.":
    "Des témoignages neutres facilitent l'aperçu de la preuve sociale.",
  "Approved customer testimonials appear here once you publish them.":
    "Les témoignages clients approuvés apparaissent ici après publication.",
  "No testimonials are published yet.":
    "Aucun témoignage n'est publié pour le moment.",
  "Approved site reviews will appear here.":
    "Les avis site approuvés apparaîtront ici.",
  "Featured highlight": "Mise en avant",
  "Highlight an announcement or offer":
    "Mettez en avant une annonce ou une offre",
  "This banner works for seasonal messages, launches, or any temporary spotlight.":
    "Cette bannière fonctionne pour les messages saisonniers, les lancements ou toute mise en avant temporaire.",
  "Banner illustration": "Illustration de bannière",
  "Top picks": "Meilleures sélections",
  "Best sellers": "Meilleures ventes",
  "Use this section for high-visibility items, featured offers, or important listings.":
    "Utilisez cette section pour les articles à forte visibilité, les offres mises en avant ou les annonces importantes.",
  "Shopping essentials": "Essentiels shopping",
  "Use this area to surface important items, launches, or offers.":
    "Utilisez cette zone pour mettre en avant des articles, lancements ou offres importants.",
  "Browse by category": "Parcourir par catégorie",
  "Find your favorite products": "Trouvez vos produits favoris",
  "Filter neutral sample entries to preview how grouped content will appear.":
    "Filtrez des éléments exemples neutres pour prévisualiser l'apparence du contenu groupé.",
  "Quick view": "Aperçu rapide",
  Reviews: "Avis",
  "{{reviewCount}} Reviews": "{{reviewCount}} avis",
  "Product Details": "Détails du produit",
  Description: "Description",
  Details: "Détails",
  Availability: "Disponibilité",
  SKU: "Référence",
  VAT: "TVA",
  "Sale mode": "Mode de vente",
  Instant: "Instantané",
  Quote: "Devis",
  Unit: "Unité",
  Color: "Couleur",
  Size: "Taille",
  "Free shipping": "Livraison gratuite",
  "On orders over {{amount}}": "À partir de {{amount}} d'achat",
  "On orders over $50.00": "À partir de 50,00 $ d'achat",
  "Easy returns": "Retours faciles",
  "30-day return window": "Retour sous 30 jours",
  "Nationwide delivery": "Livraison dans tout le pays",
  "Across the country": "Partout dans le pays",
  "Refunds policy": "Politique de remboursement",
  "A guarantee of quality": "Une garantie de qualité",
  "See sizing chart": "Voir le guide des tailles",
  Previous: "Précédent",
  Next: "Suivant",
  reviews: "avis",
  "Order Summary": "Récapitulatif",
  "Confirm order": "Confirmer la commande",
  "Pricing is hidden for this shop. Please contact us.":
    "Les prix sont masqués pour cette boutique. Veuillez nous contacter.",
  "Back to home": "Retour à l'accueil",
  "Browse products": "Parcourir les produits",
  "We could not load this page right now. Please try again.":
    "Impossible de charger cette page pour le moment. Veuillez réessayer.",
  "Page not found": "Page introuvable",
  "We could not find this page for the current catalog.":
    "Impossible de trouver cette page pour le catalogue actuel.",
  "Customers also purchased": "Les clients ont aussi acheté",
  "No related products are available yet.":
    "Aucun produit associé n'est encore disponible.",
  "No reviews yet. Be the first to share your feedback.":
    "Pas encore d'avis. Soyez le premier à partager votre retour.",
  "Write a review": "Écrire un avis",
  Name: "Nom",
  Rating: "Note",
  Title: "Titre",
  Optional: "Optionnel",
  Review: "Avis",
  "Submit review": "Envoyer l'avis",
  "Thanks! Your review is awaiting moderation.":
    "Merci ! Votre avis est en attente de modération.",
  "Reviews are published after moderation.":
    "Les avis sont publiés après modération.",
  "Please enter your name.": "Veuillez saisir votre nom.",
  "Please enter a valid email address.":
    "Veuillez saisir une adresse e-mail valide.",
  "Please write a review of at least 10 characters.":
    "Veuillez écrire un avis d'au moins 10 caractères.",
  "Unable to submit your review.": "Impossible d'envoyer votre avis.",
  "Reviews are not available yet.":
    "Les avis ne sont pas encore disponibles.",
  "Preview mode: no review is saved.":
    "Mode aperçu : aucun avis n'est enregistré.",
  "Reviews cannot contain external links.":
    "Les avis ne peuvent pas contenir de liens externes.",
  "Your review has already been received.":
    "Votre avis a déjà été reçu.",
  "Too many review attempts. Please wait before trying again.":
    "Trop de tentatives d'avis. Veuillez patienter avant de réessayer.",
  "Graduation Dresses: A Style Guide":
    "Robes de remise des diplômes : guide de style",
  "How To Wear Your Eid Pieces All Year Long":
    "Comment porter vos pièces de l'Aïd toute l'année",
  "How to Wear Your Eid Pieces All Year Long":
    "Comment porter vos pièces de l'Aïd toute l'année",
  "The Must-Have Hijabi Friendly Fabrics For 2024":
    "Les tissus compatibles hijab à avoir absolument en 2024",
  "The Must-Have Hijabi Friendly Fabrics for 2024":
    "Les tissus compatibles hijab à avoir absolument en 2024",
  "The Hijabi Friendly Fabrics For 2025":
    "Les tissus compatibles hijab pour 2025",
  "Boost your conversion rate": "Améliorez votre taux de conversion",
  "Kid with skateboard": "Enfant avec skateboard",
  "Special offer": "Offre spéciale",
  "in kids products": "sur les produits enfants",
  "Fashion is a form of self-expression and autonomy at a particular period and place.":
    "La mode est une forme d'expression de soi et d'autonomie à une époque et dans un lieu donnés.",
  "Continue with Facebook": "Continuer avec Facebook",
  "Continue with Twitter": "Continuer avec Twitter",
  "Continue with Google": "Continuer avec Google",
  Login: "Connexion",
  "Please enter an email and password.":
    "Veuillez saisir une adresse e-mail et un mot de passe.",
  "Unable to sign in.": "Connexion impossible.",
  "Login successful.": "Connexion réussie.",
  "Preview mode: no login recorded.":
    "Mode aperçu : aucune connexion n'est enregistrée.",
  "Social sign-in is not available yet. Please use email and password.":
    "La connexion sociale n'est pas encore disponible. Utilisez l'e-mail et le mot de passe.",
  "Forgot password?": "Mot de passe oublié ?",
  "Signing in...": "Connexion en cours...",
  "New user?": "Nouveau ici ?",
  "Already have an account?": "Vous avez déjà un compte ?",
  "Unable to create account.": "Impossible de créer le compte.",
  "Signup successful.": "Inscription réussie.",
  "Preview mode: no signup recorded.":
    "Mode aperçu : aucune inscription n'est enregistrée.",
  "Social signup is not available yet. Please use email and password.":
    "L'inscription sociale n'est pas encore disponible. Utilisez l'e-mail et le mot de passe.",
  "Creating account...": "Création du compte...",
  "Forgot password": "Mot de passe oublié",
  "Enter your email address to reset your password":
    "Saisissez votre adresse e-mail pour réinitialiser votre mot de passe",
  "Go back for": "Retourner vers",
  "Thanks! Your message has been sent.":
    "Merci ! Votre message a bien été envoyé.",
  Socials: "Réseaux sociaux",
  Social: "Réseau social",
  "Preview mode: no data is saved.":
    "Mode aperçu : aucune donnée n'est enregistrée.",
  "Unable to send your message.": "Impossible d'envoyer votre message.",
  "Full name": "Nom complet",
  "Example Doe": "Jean Dupont",
  Message: "Message",
  "Do not fill out this field": "Ne pas remplir ce champ",
  "Sending...": "Envoi en cours...",
  "Send Message": "Envoyer le message",
  "example@example.com": "exemple@exemple.com",
  "Product not found": "Produit introuvable",
  "Something went wrong": "Un problème est survenu",
  "We could not find this product for the current catalog.":
    "Nous n'avons pas trouvé ce produit dans le catalogue actuel.",
  "We could not load this product right now. Please refresh and try again.":
    "Nous n'avons pas pu charger ce produit pour le moment. Actualisez la page puis réessayez.",
  Collection: "Collection",
  collection: "collection",
  "New in": "Nouveauté",
  "Sale collection": "Collection en promotion",
  Discover: "Découvrir",
  item: "article",
  items: "articles",
  "in this collection.": "dans cette collection.",
  "No products are currently assigned to this collection.":
    "Aucun produit n'est actuellement attribué à cette collection.",
  Filters: "Filtres",
  Filter: "Filtrer",
  "Type your keywords": "Saisissez vos mots-clés",
  "Search keywords": "Rechercher par mots-clés",
  "Submit search": "Lancer la recherche",
  Newest: "Plus récent",
  Showing: "Affichage",
  result: "résultat",
  results: "résultats",
  for: "pour",
  "No products matched your search. Try another keyword or clear the filters.":
    "Aucun produit ne correspond à votre recherche. Essayez un autre mot-clé ou effacez les filtres.",
  "Most Popular": "Les plus populaires",
  "Best Rating": "Meilleure note",
  "Price Low - High": "Prix croissant",
  "Price High - Low": "Prix décroissant",
  "Name (A-Z)": "Nom (A-Z)",
  "New Arrivals": "Nouvelles arrivées",
  Backpacks: "Sacs à dos",
  "Travel Bags": "Sacs de voyage",
  Accessories: "Accessoires",
  "T-shirts": "T-shirts",
  Hoodies: "Sweats à capuche",
  Beige: "Beige",
  Blue: "Bleu",
  Black: "Noir",
  Brown: "Marron",
  Green: "Vert",
  "Go to slide": "Aller à la diapositive",
  "Go to testimonial": "Aller au témoignage",
  "Please sign in.": "Veuillez vous connecter.",
  "Name is required.": "Le nom est obligatoire.",
  "Invalid email address.": "Adresse e-mail invalide.",
  "Product is required.": "Le produit est obligatoire.",
  "Product not found.": "Produit introuvable.",
  "Account inactive.": "Compte inactif.",
  "Site unavailable.": "Site indisponible.",
  "Access denied.": "Accès refusé.",
  "Unable to load account.": "Impossible de charger le compte.",
  "Unable to update account.": "Impossible de mettre à jour le compte.",
  "Updating account...": "Mise à jour du compte...",
  "Account updated.": "Compte mis à jour.",
  "Account information": "Informations du compte",
  "Date of birth": "Date de naissance",
  Gender: "Genre",
  Male: "Homme",
  Female: "Femme",
  Other: "Autre",
  "Phone number": "Numéro de téléphone",
  "About you": "À votre sujet",
  "Update account": "Mettre à jour le compte",
  "Updating...": "Mise à jour...",
  "Loading details...": "Chargement des détails...",
  "Product unavailable": "Produit indisponible",
  "This item is no longer available.":
    "Cet article n'est plus disponible.",
  Unavailable: "Indisponible",
  Removed: "Retiré",
  "Check out your wishlists. You can add or remove items from your wishlists.":
    "Consultez vos favoris. Vous pouvez y ajouter ou retirer des articles.",
  "You have no saved items yet.": "Vous n'avez encore aucun article enregistré.",
  "Show me more": "Afficher plus",
  review: "avis",
  "Order history": "Historique des commandes",
  "Check the status of recent orders, manage returns, and discover similar products.":
    "Consultez l'état de vos commandes récentes, gérez les retours et découvrez des produits similaires.",
  "Delivered on": "Livré le",
  "Buy again": "Racheter",
  "View order": "Voir la commande",
  Qty: "Qté",
  "Leave review": "Laisser un avis",
  "Update your password": "Mettez à jour votre mot de passe",
  "Update your password to keep your account secure.":
    "Mettez à jour votre mot de passe pour garder votre compte sécurisé.",
  "Please enter your current password.":
    "Veuillez saisir votre mot de passe actuel.",
  "New password must be at least 8 characters.":
    "Le nouveau mot de passe doit contenir au moins 8 caractères.",
  "Updating password...": "Mise à jour du mot de passe...",
  "Current password": "Mot de passe actuel",
  "New password": "Nouveau mot de passe",
  "Confirm password": "Confirmer le mot de passe",
  "Update password": "Mettre à jour le mot de passe",
  "Please enter your current password and a new password of at least 8 characters.":
    "Veuillez saisir votre mot de passe actuel et un nouveau mot de passe d'au moins 8 caractères.",
  "New password and confirmation do not match.":
    "Le nouveau mot de passe et sa confirmation ne correspondent pas.",
  "Invalid password update request.":
    "Demande de mise à jour du mot de passe invalide.",
  "Password cannot be updated for this account.":
    "Le mot de passe ne peut pas être mis à jour pour ce compte.",
  "Current password is incorrect.":
    "Le mot de passe actuel est incorrect.",
  "Password updated successfully.":
    "Mot de passe mis à jour avec succès.",
  "Unable to update password.":
    "Impossible de mettre à jour le mot de passe.",
  "Thanks for ordering": "Merci pour votre commande",
  "Payment successful!": "Paiement réussi !",
  "We appreciate your order, we're currently processing it. So hang tight and we'll send you confirmation very soon!":
    "Merci pour votre commande, elle est en cours de traitement. Patientez encore un peu, nous vous enverrons très bientôt une confirmation !",
  "Tracking number": "Numéro de suivi",
  "Continue shopping": "Continuer les achats",
  "Shipping address": "Adresse de livraison",
  "Payment information": "Informations de paiement",
  "Ending with": "Se terminant par",
  Expires: "Expire",
  Total: "Total",
  "Order placed": "Commande passée",
  Order: "Commande",
  Processing: "Traitement",
  Shipped: "Expédiée",
  Delivered: "Livrée",
  "Preparing to ship on March 24, 2021":
    "Préparation de l'expédition le 24 mars 2021",
  "Shipped on March 23, 2021": "Expédiée le 23 mars 2021",
  "View invoice": "Voir la facture",
  "Delivery address": "Adresse de livraison",
  "Shipping updates": "Mises à jour de livraison",
  Edit: "Modifier",
  "Billing address": "Adresse de facturation",
  Comments: "Commentaires",
  "Write a comment...": "Écrire un commentaire...",
  "Submit the comment": "Publier le commentaire",
  "Related posts": "Articles liés",
  Marketing: "Marketing",
  "Directional signposts": "Panneaux indicateurs",
  "Scott is an editorial designer and copywriter with over 10 years of experience. He loves crafting unique and human-centered experiences.":
    "Scott est designer éditorial et concepteur-rédacteur depuis plus de 10 ans. Il aime créer des expériences uniques et centrées sur l'humain.",
  "5 min read": "5 min de lecture",
  "6 min read": "6 min de lecture",
  Instagram: "Instagram",
  LinkedIn: "LinkedIn",
  "No products found for this collection yet.":
    "Aucun produit n'a encore été trouvé pour cette collection.",
  "Excellent new arrivals for every occasion, from casual to formal, explore our collection of trendy pieces that elevate your outfit.":
    "D'excellentes nouveautés pour chaque occasion, du décontracté au formel : découvrez notre collection de pièces tendance qui rehaussent votre tenue.",
  "Please enter a valid email and password.":
    "Veuillez saisir une adresse e-mail valide et un mot de passe.",
  "Invalid login request.": "Demande de connexion invalide.",
  "Login link does not match this site. Please reload and try again.":
    "Le lien de connexion ne correspond pas à ce site. Rechargez la page puis réessayez.",
  "Invalid email or password.":
    "Adresse e-mail ou mot de passe invalide.",
  "Account inactive. Please contact support.":
    "Compte inactif. Veuillez contacter le support.",
  "Please enter a valid email and a password of at least 8 characters.":
    "Veuillez saisir une adresse e-mail valide et un mot de passe d'au moins 8 caractères.",
  "Invalid signup request.": "Demande d'inscription invalide.",
  "Signup link does not match this site. Please reload and try again.":
    "Le lien d'inscription ne correspond pas à ce site. Rechargez la page puis réessayez.",
  "Signup blocked by access policy. Please contact support.":
    "L'inscription est bloquée par la politique d'accès. Veuillez contacter le support.",
  "Account already exists. Please sign in.":
    "Le compte existe déjà. Veuillez vous connecter.",
  "Account linked. Thanks!": "Compte lié. Merci !",
  "Invalid path.": "Chemin invalide.",
  "Phone number is required to place this order.":
    "Le numéro de téléphone est requis pour passer cette commande.",
  "Address is required to place this order.":
    "L'adresse est requise pour passer cette commande.",
  "Company name is required.":
    "Le nom de société est obligatoire.",
  "Tax registration number is required.":
    "Le matricule fiscal est obligatoire.",
  "Please accept the terms and conditions.":
    "Veuillez accepter les conditions générales.",
  "Payment method is required.": "Le mode de paiement est obligatoire.",
  "This product cannot be purchased online.":
    "Ce produit ne peut pas être acheté en ligne.",
  "Unable to create your order right now.":
    "Impossible de créer votre commande pour le moment.",
  "Preview mode: no order recorded.":
    "Mode aperçu : aucune commande n'est enregistrée.",
  "Page not found.": "Page introuvable.",
  "Unable to fetch page.": "Impossible de charger la page.",
  "Invalid confirmation.": "Confirmation invalide.",
  "Order not found.": "Commande introuvable.",
  "Unable to fetch order.": "Impossible de récupérer la commande.",
  "Proof storage is not configured.":
    "Le stockage des preuves n'est pas configuré.",
  "Unable to store the proof. Unknown error.":
    "Impossible de stocker la preuve. Erreur inconnue.",
  "Invalid order.": "Commande invalide.",
  "Preview mode: no proof file was saved.":
    "Mode aperçu : aucun justificatif n'a été enregistré.",
  "Invalid proof file.": "Fichier de preuve invalide.",
  "The proof exceeds the 6 MB limit.":
    "La preuve dépasse la limite de 6 Mo.",
  "Unsupported proof format. Use PNG, JPG, WEBP, or PDF.":
    "Format de preuve non pris en charge. Utilisez PNG, JPG, WEBP ou PDF.",
  "Unable to save the proof.": "Impossible d'enregistrer la preuve.",
  "Invalid return URL.": "URL de retour invalide.",
  "Payment is unavailable in preview mode.":
    "Le paiement est indisponible en mode aperçu.",
  "Unable to create the payment session.":
    "Impossible de créer la session de paiement.",
  "Invalid form data.": "Données du formulaire invalides.",
  "Request blocked.": "Demande bloquée.",
  "Preview mode: no quote request recorded.":
    "Mode aperçu : aucune demande de devis n'est enregistrée.",
  "This product cannot be requested as a quote.":
    "Ce produit ne peut pas faire l'objet d'une demande de devis.",
  "We already received your request. Please wait before sending another message.":
    "Nous avons déjà reçu votre demande. Merci d'attendre avant d'envoyer un autre message.",
  "Description must not contain external links.":
    "La description ne doit pas contenir de liens externes.",
  "Form fields must not contain external links.":
    "Les champs ne doivent pas contenir de liens externes.",
  "Thanks! Your quote request has been sent to the team.":
    "Merci ! Votre demande de devis a bien été transmise à l'équipe.",
  "Unable to save the request.":
    "Impossible d'enregistrer la demande.",
  "Thank you! Your request has been forwarded to the team.":
    "Merci ! Votre demande a bien été transmise à l'équipe.",
  "Unable to load wishlist.": "Impossible de charger les favoris.",
  "Wishlist is not available.": "Les favoris ne sont pas disponibles.",
  "Unable to update wishlist.": "Impossible de mettre à jour les favoris.",
  "Review unavailable": "Avis indisponible",
  "Order placed on": "Commande passée le",
  "No products match this collection yet.":
    "Aucun produit ne correspond encore à cette collection.",
  "No articles published yet": "Aucun article publié pour le moment",
  "Published posts will appear here automatically as soon as the editorial team sends them live.":
    "Les articles publiés apparaîtront ici automatiquement dès que l'équipe éditoriale les mettra en ligne.",
  "Invoice requests are only available during the same calendar month as the order date.":
    "Les demandes de facture sont disponibles uniquement pendant le même mois calendaire que la date de commande.",
  "We could not load this article right now. Please try again.":
    "Impossible de charger cet article pour le moment. Veuillez réessayer.",
  "Back to the blog": "Retour au blog",
  "Article not found": "Article introuvable",
  "This article is unavailable or has not been published yet.":
    "Cet article est indisponible ou n'a pas encore été publié.",
  Tags: "Étiquettes",
  "Continue your research": "Poursuivre votre recherche",
  "Explore matching guides, collections, and licences":
    "Explorez les guides, collections et licences associés",
  "Recommended licences": "Licences recommandées",
  "Browse all guides": "Voir tous les guides",
  "Topic hubs": "Dossiers thématiques",
  "Move from advice to action with direct paths from guides to the most relevant collections and licences.":
    "Passez du conseil à l'action avec des liens directs vers les collections et licences les plus pertinentes.",
  "There are no additional articles on this page yet.":
    "Il n'y a pas encore d'articles supplémentaires sur cette page.",
  "No published articles yet": "Aucun article publié pour le moment",
  "This journal will fill automatically when the first post is published from the admin workspace.":
    "Ce journal se remplira automatiquement dès que le premier article sera publié depuis l'espace d'administration.",
  "Guide cluster": "Groupe de guides",
  "Read the guide": "Lire le guide",
  "Editorial illustration": "Illustration éditoriale",
  "Unable to load orders.": "Impossible de charger les commandes.",
  "No orders yet": "Aucune commande pour le moment",
  "Your future orders will appear here as soon as they are confirmed.":
    "Vos prochaines commandes apparaîtront ici dès qu'elles seront confirmées.",
  "Customize this page": "Personnaliser cette page",
  "Out of stock": "Rupture de stock",
  "In stock": "Disponible",
  "No products found yet.": "Aucun produit trouvé pour le moment.",
  "2500": "2500",
};

const EN_TRANSLATIONS: Record<string, string> = {
  Logiciels: "Software",
  "Rupture de stock": "Out of stock",
  Disponible: "In stock",
  "Requête bloquée.": "Request blocked.",
  "Requete bloquee.": "Request blocked.",
  "Site indisponible.": "Site unavailable.",
  "Produit introuvable": "Product not found",
  "Produit introuvable.": "Product not found.",
  "Commande introuvable": "Order not found",
  "Commande introuvable.": "Order not found.",
  "Paiement introuvable": "Payment not found",
  "Paiement introuvable.": "Payment not found.",
  "Ce paiement n'est pas un virement bancaire.":
    "This payment is not a bank transfer.",
  "Nous avons bien reçu votre demande. Merci de patienter avant de renvoyer un message.":
    "We already received your request. Please wait before sending another message.",
  "La description ne doit pas contenir de liens externes.":
    "Description must not contain external links.",
  "Tous droits réservés.": "All rights reserved.",
  "Sélecteur de langue et de devise": "Language and currency selector",
  "Mode de sélection": "Selector mode",
  "États-Unis": "United States",
  "Langue": "Language",
  Devise: "Currency",
  "À propos": "About",
  "Aucun témoignage n'est publié pour le moment.":
    "No testimonials are published yet.",
  "Les avis site approuvés apparaîtront ici.":
    "Approved site reviews will appear here.",
  "Voir les détails": "View details",
  "Écrire un avis": "Write a review",
  "{{reviewCount}} avis": "{{reviewCount}} Reviews",
  Référence: "SKU",
  TVA: "VAT",
  "Mode de vente": "Sale mode",
  Instantané: "Instant",
  Devis: "Quote",
  "Livraison gratuite": "Free shipping",
  "À partir de {{amount}} d'achat": "On orders over {{amount}}",
  "À partir de 50,00 $ d'achat": "On orders over $50.00",
  "Retours faciles": "Easy returns",
  "Retour sous 30 jours": "30-day return window",
  "Livraison dans tout le pays": "Nationwide delivery",
  "Partout dans le pays": "Across the country",
  "Politique de remboursement": "Refunds policy",
  "Une garantie de qualité": "A guarantee of quality",
  "Voir le guide des tailles": "See sizing chart",
};

export function parseCisecoLocale(
  value: string | null | undefined,
): CisecoLocale | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "fr" || normalized.startsWith("fr-")) return "fr";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function resolveCisecoLocale(
  ...values: Array<string | null | undefined>
): CisecoLocale {
  for (const value of values) {
    const locale = parseCisecoLocale(value);
    if (locale) return locale;
  }
  return DEFAULT_CISECO_LOCALE;
}

export function appendCisecoLocaleToHref(
  href: string,
  locale: CisecoLocale,
): string {
  if (!href || href === "#" || href.startsWith("#")) {
    return href;
  }
  if (EXTERNAL_HREF_PATTERN.test(href)) {
    return href;
  }

  const [withoutHash, hash = ""] = href.split("#");
  const [pathname, query = ""] = withoutHash.split("?");
  const params = new URLSearchParams(query);
  params.set(CISECO_LOCALE_QUERY_PARAM, locale);
  const nextQuery = params.toString();

  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}

export function translateCisecoText(
  locale: CisecoLocale,
  text: string,
): string {
  if (locale === "fr") {
    return FRENCH_TRANSLATIONS[text] ?? text;
  }
  return EN_TRANSLATIONS[text] ?? text;
}

export function formatCisecoDate(
  locale: CisecoLocale,
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return translateCisecoText(locale, String(value));
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", options)
    .format(date);
}

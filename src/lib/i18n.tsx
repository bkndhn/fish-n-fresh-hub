import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "en" | "ta" | "hi";

const translations = {
  en: {
    "nav.catalog": "Browse Catalog",
    "nav.cart": "Cart",
    "nav.account": "Account",
    "home.categories": "Categories",
    "home.featured": "Featured Products",
    "home.bestsellers": "Best Sellers",
    "home.view_all": "View All",
    "product.add": "Add to Cart",
    "checkout.title": "Checkout",
    "footer.support": "Support & Contact",
    "footer.legal": "Legal & Safety",
  },
  ta: {
    "nav.catalog": "பட்டியல்",
    "nav.cart": "கூடை",
    "nav.account": "கணக்கு",
    "home.categories": "வகைகள்",
    "home.featured": "சிறப்பு தயாரிப்புகள்",
    "home.bestsellers": "அதிகம் விற்பனையானவை",
    "home.view_all": "அனைத்தையும் காண்",
    "product.add": "கூடையில் சேர்",
    "checkout.title": "பணம் செலுத்து",
    "footer.support": "ஆதரவு & தொடர்பு",
    "footer.legal": "சட்ட & பாதுகாப்பு",
  },
  hi: {
    "nav.catalog": "कैटलॉग देखें",
    "nav.cart": "कार्ट",
    "nav.account": "खाता",
    "home.categories": "श्रेणियाँ",
    "home.featured": "विशेष उत्पाद",
    "home.bestsellers": "सर्वाधिक बिकने वाले",
    "home.view_all": "सभी देखें",
    "product.add": "कार्ट में डालें",
    "checkout.title": "चेकआउट",
    "footer.support": "सहायता और संपर्क",
    "footer.legal": "कानूनी और सुरक्षा",
  }
};

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("fnf_lang") as Language;
    if (saved && ["en", "ta", "hi"].includes(saved)) {
      setLang(saved);
    }
  }, []);

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("fnf_lang", newLang);
  };

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations["en"][key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}

import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";
import jsQR from "jsqr";
import { useEffect, useMemo, useState } from "react";
import { MOCK_QRS, type ProductQr } from "./src/data/mockQrs";
import {
  Alert,
  Button,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

type AppScreen =
  | "home"
  | "scanQr"
  | "points"
  | "history"
  | "store"
  | "profile"
  | "about";

type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  totalPoints: number;
};

type Transaction = {
  id: string;
  userId: string;
  qrId: string;
  qrCode: string;
  photoPath: string;
  binType: "normal" | "recycle";
  analysisResult?: "recycling_bin" | "trash_bin" | "no_bin_detected" | "uncertain";
  basePoints: number;
  earnedPoints: number;
  date: string;
};

type StoreProduct = {
  id: string;
  productName: string;
  description: string;
  pointPrice: number;
  image: string;
};

type Purchase = {
  id: string;
  userId: string;
  storeProductId: string;
  spentPoints: number;
  date: string;
};

type QrErrorLog = {
  id: string;
  date: string;
  reason: string;
};

type RecycleSummary = {
  binType: "normal" | "recycle";
  analysisResult: "recycling_bin" | "trash_bin" | "no_bin_detected" | "uncertain";
  basePoints: number;
  earnedPoints: number;
};

type PhotoAnalysisResult = "recycling_bin" | "trash_bin" | "no_bin_detected" | "uncertain";

const HtmlInput: any = "input";
const STORAGE_KEYS = {
  users: "dongu_users",
  currentUserId: "dongu_current_user_id",
  qrs: "dongu_qrs",
  transactions: "dongu_transactions",
  purchases: "dongu_purchases",
};

const STORE_PRODUCTS: StoreProduct[] = [
  {
    id: "s-1",
    productName: "Bez Çanta",
    description: "Günlük kullanım için çevreci bez çanta",
    pointPrice: 120,
    image: "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "s-2",
    productName: "Çelik Su Şişesi",
    description: "Tekrar kullanılabilir 500ml şişe",
    pointPrice: 200,
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "s-3",
    productName: "Bambu Diş Fırçası Seti",
    description: "2'li çevre dostu fırça seti",
    pointPrice: 80,
    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=1400&q=80",
  },
];

export default function App() {
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 700;
  const isDesktop = screenWidth >= 1100;
  const productCardWidth = isDesktop ? "31.5%" : isTablet ? "48.5%" : "100%";

  // MVP'de verileri bellekte tutuyoruz; gerçek sürümde backend + veritabanı kullanılmalı.
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [qrs, setQrs] = useState<ProductQr[]>(MOCK_QRS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [screen, setScreen] = useState<AppScreen>("home");
  const [qrMessage, setQrMessage] = useState("");
  const [pendingQrId, setPendingQrId] = useState<string | null>(null);
  const [qrPhotoPath, setQrPhotoPath] = useState("");
  const [wastePhotoPath, setWastePhotoPath] = useState("");
  const [isDecodingQr, setIsDecodingQr] = useState(false);
  const [decodedQrText, setDecodedQrText] = useState("");
  const [qrErrorLogs, setQrErrorLogs] = useState<QrErrorLog[]>([]);
  const [selectedBinType, setSelectedBinType] = useState<"normal" | "recycle" | null>(null);
  const [lastRecycleSummary, setLastRecycleSummary] = useState<RecycleSummary | null>(null);
  const [wasteAnalysisResult, setWasteAnalysisResult] = useState<PhotoAnalysisResult | null>(null);
  const [wasteAnalysisMessage, setWasteAnalysisMessage] = useState("");
  const [isAnalyzingWastePhoto, setIsAnalyzingWastePhoto] = useState(false);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [users, currentUserId]
  );

  const pendingQr = useMemo(
    () => qrs.find((item) => item.id === pendingQrId) ?? null,
    [qrs, pendingQrId]
  );

  const userTransactions = useMemo(
    () => transactions.filter((item) => item.userId === currentUserId),
    [transactions, currentUserId]
  );

  const userPurchases = useMemo(
    () => purchases.filter((item) => item.userId === currentUserId),
    [purchases, currentUserId]
  );

  const mergeSavedQrsWithDefaults = (savedQrs: ProductQr[]): ProductQr[] => {
    const savedByCode = new Map(savedQrs.map((qr) => [qr.qrCode, qr]));
    return MOCK_QRS.map((defaultQr) => {
      const saved = savedByCode.get(defaultQr.qrCode);
      if (!saved) return defaultQr;
      return { ...defaultQr, ...saved, productType: defaultQr.productType };
    });
  };

  const quickActions: Array<{ key: AppScreen; label: string; icon: string }> = [
    { key: "scanQr", label: "QR Tara", icon: "📷" },
    { key: "store", label: "Magaza", icon: "🛍️" },
    { key: "about", label: "Hakkinda", icon: "🌿" },
  ];

  useEffect(() => {
    const hydrateData = async () => {
      try {
        const [savedUsers, savedCurrentUserId, savedQrs, savedTransactions, savedPurchases] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.users),
            AsyncStorage.getItem(STORAGE_KEYS.currentUserId),
            AsyncStorage.getItem(STORAGE_KEYS.qrs),
            AsyncStorage.getItem(STORAGE_KEYS.transactions),
            AsyncStorage.getItem(STORAGE_KEYS.purchases),
          ]);

        const parsedUsers: User[] = savedUsers ? JSON.parse(savedUsers) : [];
        const parsedQrsRaw: ProductQr[] = savedQrs ? JSON.parse(savedQrs) : MOCK_QRS;
        const parsedQrs: ProductQr[] = mergeSavedQrsWithDefaults(parsedQrsRaw);
        const parsedTransactions: Transaction[] = savedTransactions ? JSON.parse(savedTransactions) : [];
        const parsedPurchases: Purchase[] = savedPurchases ? JSON.parse(savedPurchases) : [];
        const parsedCurrentUserId = savedCurrentUserId ?? null;

        setUsers(parsedUsers);
        setQrs(parsedQrs);
        setTransactions(parsedTransactions);
        setPurchases(parsedPurchases);

        if (parsedCurrentUserId && parsedUsers.some((user) => user.id === parsedCurrentUserId)) {
          setCurrentUserId(parsedCurrentUserId);
        } else {
          setCurrentUserId(null);
        }
      } catch (error) {
        console.error("Storage hydrate error:", error);
      } finally {
        setIsHydrated(true);
      }
    };

    hydrateData();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users)).catch((error) =>
      console.error("Users persist error:", error)
    );
  }, [users, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    const persistSession = async () => {
      try {
        if (currentUserId) {
          await AsyncStorage.setItem(STORAGE_KEYS.currentUserId, currentUserId);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.currentUserId);
        }
      } catch (error) {
        console.error("Session persist error:", error);
      }
    };
    persistSession();
  }, [currentUserId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.qrs, JSON.stringify(qrs)).catch((error) =>
      console.error("QR persist error:", error)
    );
  }, [qrs, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions)).catch((error) =>
      console.error("Transaction persist error:", error)
    );
  }, [transactions, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.purchases, JSON.stringify(purchases)).catch((error) =>
      console.error("Purchase persist error:", error)
    );
  }, [purchases, isHydrated]);

  const resetAuthFields = () => {
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
  };

  const handleRegister = () => {
    if (!authName || !authEmail || !authPassword) {
      setAuthMessage("Lütfen tüm alanları doldurun.");
      return;
    }
    const exists = users.some((user) => user.email.toLowerCase() === authEmail.toLowerCase());
    if (exists) {
      setAuthMessage("Bu e-posta zaten kayıtlı.");
      return;
    }

    const newUser: User = {
      id: `u-${Date.now()}`,
      name: authName,
      email: authEmail.trim(),
      password: authPassword,
      totalPoints: 0,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    setAuthMessage("");
    resetAuthFields();
    setScreen("home");
  };

  const handleLogin = () => {
    const userByEmail = users.find((user) => user.email.toLowerCase() === authEmail.toLowerCase().trim());
    if (!userByEmail) {
      setAuthMessage("Kullanıcı bulunamadı.");
      return;
    }
    if (userByEmail.password !== authPassword) {
      setAuthMessage("Şifre yanlış.");
      return;
    }
    setCurrentUserId(userByEmail.id);
    setAuthMessage("");
    resetAuthFields();
    setScreen("home");
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    setPendingQrId(null);
    setQrPhotoPath("");
    setWastePhotoPath("");
    setWasteAnalysisResult(null);
    setWasteAnalysisMessage("");
    setSelectedBinType(null);
    setQrMessage("");
    setDecodedQrText("");
    setScreen("home");
  };

  const validateQrData = (qrData: string) => {
    setDecodedQrText(qrData);
    const qr = qrs.find((item) => item.qrCode.toLowerCase() === qrData.toLowerCase().trim());
    if (!qr) {
      setQrMessage("QR kod sistemde bulunamadı.");
      setPendingQrId(null);
      setQrErrorLogs((prev) => [
        {
          id: `qr-err-${Date.now()}`,
          date: new Date().toLocaleString("tr-TR"),
          reason: "Sistemde kayıtlı olmayan QR okutuldu.",
        },
        ...prev.slice(0, 4),
      ]);
      return;
    }
    if (!qr.isActive) {
      setQrMessage("Bu QR kod daha önce kullanılmıştır.");
      setPendingQrId(null);
      setQrErrorLogs((prev) => [
        {
          id: `qr-err-${Date.now()}`,
          date: new Date().toLocaleString("tr-TR"),
          reason: "Daha önce kullanılımış QR tekrar okutuldu.",
        },
        ...prev.slice(0, 4),
      ]);
      return;
    }

    setPendingQrId(qr.id);
    setWastePhotoPath("");
    setWasteAnalysisResult(null);
    setWasteAnalysisMessage("");
    setSelectedBinType(null);
    setQrMessage(
      `QR doğrulandı: ${qr.productName} (Temel puan: ${qr.weight}). Şimdi fotoğraf yükleyerek işlemi tamamlayın.`
    );
    setScreen("scanQr");
  };

  const decodeQrFromImage = async (uri: string) => {
    setIsDecodingQr(true);
    setDecodedQrText("");
    try {
      if (Platform.OS === "web") {
        const image = new window.Image();
        image.src = uri;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = (error) => reject(error);
        });

        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context) {
          console.error("QR decode error: canvas context alinamadi.");
          setQrMessage("QR işlenemedi. Lütfen farklı bir görsel deneyin.");
          setPendingQrId(null);
          setQrErrorLogs((prev) => [
            {
              id: `qr-err-${Date.now()}`,
              date: new Date().toLocaleString("tr-TR"),
              reason: "Tarayici görsel işlemede canvas context üretmedi.",
            },
            ...prev.slice(0, 4),
          ]);
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);

        if (!decoded?.data) {
          console.error("QR decode failed: jsQR sonuc vermedi.", {
            width: imageData.width,
            height: imageData.height,
          });
          setQrMessage(
            "QR okunamadi. Görsel çok bulanık olabilir, QR kadrajda küçük kalmış olabilir veya desteklenmeyen format olabilir."
          );
          setPendingQrId(null);
          setQrErrorLogs((prev) => [
            {
              id: `qr-err-${Date.now()}`,
              date: new Date().toLocaleString("tr-TR"),
              reason: "QR desenleri seçilen görselde algılanamadı.",
            },
            ...prev.slice(0, 4),
          ]);
          return;
        }

        validateQrData(decoded.data);
        return;
      }

      const result = await Camera.scanFromURLAsync(uri);
      if (!result.length || !result[0]?.data) {
        console.error("QR decode failed: Camera.scanFromURLAsync sonuc vermedi.", { uri });
        setQrMessage(
          "QR okunamadi. Görsel çok bulanık olabilir, QR kadrajda küçük kalmış olabilir veya desteklenmeyen format olabilir."
        );
        setPendingQrId(null);
        setQrErrorLogs((prev) => [
          {
            id: `qr-err-${Date.now()}`,
            date: new Date().toLocaleString("tr-TR"),
            reason: "Native tarayıcı seçilen görselde QR verisi bulamadı.",
          },
          ...prev.slice(0, 4),
        ]);
        return;
      }

      validateQrData(result[0].data);
    } catch (error) {
      console.error("QR decode exception:", error);
      setQrMessage(
        "QR okunamadi. Görsel çok bulanık olabilir, QR kadrajda küçük kalmış olabilir veya desteklenmeyen format olabilir."
      );
      setPendingQrId(null);
      setQrErrorLogs((prev) => [
        {
          id: `qr-err-${Date.now()}`,
          date: new Date().toLocaleString("tr-TR"),
          reason: "QR okuma sırasında teknik hata oluştu.",
        },
        ...prev.slice(0, 4),
      ]);
    } finally {
      setIsDecodingQr(false);
    }
  };

  const processImageForTarget = async (uri: string, target: "qr" | "waste") => {
    if (target === "qr") {
      setQrPhotoPath(uri);
      setQrMessage("QR görseli alındı. QR okunuyor...");
      await decodeQrFromImage(uri);
      return;
    }
    setWastePhotoPath(uri);
    setWasteAnalysisResult(null);
    setWasteAnalysisMessage("Atik gorseli alindi. Kutu tipi analizi yapiliyor...");
    await analyzeWastePhoto(uri);
  };

  const runMockPhotoAnalysis = async (photoUri: string): Promise<PhotoAnalysisResult> => {
    // Mock analiz: gelecekte AI servisi eklenecek alan.
    const lowerUri = photoUri.toLowerCase();
    if (lowerUri.includes("recycle") || lowerUri.includes("geri") || lowerUri.includes("donusum")) {
      return "recycling_bin";
    }
    if (lowerUri.includes("trash") || lowerUri.includes("cop") || lowerUri.includes("normal")) {
      return "trash_bin";
    }
    if (lowerUri.includes("no-bin") || lowerUri.includes("nobin") || lowerUri.includes("none")) {
      return "no_bin_detected";
    }
    return "uncertain";
  };

  const analyzeWastePhoto = async (photoUri: string) => {
    setIsAnalyzingWastePhoto(true);
    try {
      const result = await runMockPhotoAnalysis(photoUri);
      setWasteAnalysisResult(result);

      if (result === "recycling_bin") {
        setWasteAnalysisMessage("Geri donusum kutusu tespit edildi.");
      } else if (result === "trash_bin") {
        setWasteAnalysisMessage("Normal cop kutusu tespit edildi.");
      } else if (result === "no_bin_detected") {
        setWasteAnalysisMessage("Kutu algilanamadi, lutfen yeniden deneyin.");
      } else {
        setWasteAnalysisMessage("Gorsel net degil. Lutfen daha net bir fotograf yukleyin.");
      }
    } catch (error) {
      console.error("Waste analysis error:", error);
      setWasteAnalysisResult("uncertain");
      setWasteAnalysisMessage("Analiz sirasinda bir hata olustu. Lutfen daha net bir fotograf deneyin.");
    } finally {
      setIsAnalyzingWastePhoto(false);
    }
  };

  const calculateRecyclePoints = (
    selectedBin: "normal" | "recycle",
    analysisResult: PhotoAnalysisResult,
    basePoints: number
  ) => {
    if (analysisResult === "no_bin_detected") {
      return {
        canProceed: false,
        earnedPoints: 0,
        userMessage: "Kutu algilanamadi, lutfen yeniden deneyin.",
      };
    }
    if (analysisResult === "uncertain") {
      return {
        canProceed: true,
        earnedPoints: basePoints,
        userMessage:
          "Gorsel net degil. Bu islemde standart puan verildi. Lutfen bir sonraki denemede daha net fotograf yukleyin.",
      };
    }
    if (selectedBin === "recycle" && analysisResult === "recycling_bin") {
      return {
        canProceed: true,
        earnedPoints: basePoints * 2,
        userMessage: "Geri donusum kutusu dogrulandi, 2x puan kazandiniz!",
      };
    }
    if (selectedBin === "recycle" && analysisResult === "trash_bin") {
      return {
        canProceed: true,
        earnedPoints: basePoints,
        userMessage: "Normal cop kutusu tespit edildi. Bu islemde standart puan verildi.",
      };
    }
    return {
      canProceed: true,
      earnedPoints: basePoints,
      userMessage:
        analysisResult === "recycling_bin"
          ? "Geri donusum kutusu tespit edildi. Bir sonraki islemde geri donusum secerek 2x alabilirsiniz."
          : "Normal cop kutusu tespit edildi.",
    };
  };

  const handleWebFileChange = async (event: any, target: "qr" | "waste") => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    await processImageForTarget(objectUrl, target);
    event.target.value = "";
  };

  const pickFromGallery = async (target: "qr" | "waste") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("İzin Gerekli", "Galeri için izin vermelisiniz.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      await processImageForTarget(result.assets[0].uri, target);
    }
  };

  const captureWithCamera = async (target: "qr" | "waste") => {
    const permission = await Camera.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("İzin Gerekli", "Kamera izni vermelisiniz.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      await processImageForTarget(result.assets[0].uri, target);
    }
  };

  const completeRecycleFlow = () => {
    if (!currentUser || !pendingQr) {
      Alert.alert("Hata", "Önce geçerli bir QR kod okutun.");
      return;
    }
    if (!wastePhotoPath) {
      Alert.alert("Fotoğraf Zorunlu", "İşlemi tamamlamak için fotoğraf yüklemelisiniz.");
      return;
    }
    if (!selectedBinType) {
      Alert.alert("Kutu Tipi Seçin", "Lütfen atığı hangi kutuya attığınızı seçin.");
      return;
    }
    if (!wasteAnalysisResult) {
      Alert.alert("Analiz Bekleniyor", "Atik fotografi analizi tamamlanmadi. Lutfen bekleyin.");
      return;
    }

    const basePoints = pendingQr.weight;
    const pointDecision = calculateRecyclePoints(selectedBinType, wasteAnalysisResult, basePoints);
    if (!pointDecision.canProceed) {
      Alert.alert("Islem Tamamlanamadi", pointDecision.userMessage);
      return;
    }
    const earnedPoints = pointDecision.earnedPoints;
    const binTypeText = selectedBinType === "recycle" ? "Geri Dönüşüm Kutusu" : "Normal Çöp Kutusu";
    const bonusText = pointDecision.userMessage;

    setQrs((prev) => prev.map((item) => (item.id === pendingQr.id ? { ...item, isActive: false } : item)));
    setUsers((prev) =>
      prev.map((user) =>
        user.id === currentUser.id ? { ...user, totalPoints: user.totalPoints + earnedPoints } : user
      )
    );
    setTransactions((prev) => [
      {
        id: `t-${Date.now()}`,
        userId: currentUser.id,
        qrId: pendingQr.id,
        qrCode: pendingQr.qrCode,
        photoPath: wastePhotoPath,
        binType: selectedBinType,
        analysisResult: wasteAnalysisResult,
        basePoints,
        earnedPoints,
        date: new Date().toLocaleString("tr-TR"),
      },
      ...prev,
    ]);

    setLastRecycleSummary({
      binType: selectedBinType,
      analysisResult: wasteAnalysisResult,
      basePoints,
      earnedPoints,
    });
    Alert.alert(
      "Islem Basarili",
      `Kutu tipi: ${binTypeText}\nTemel puan: ${basePoints}\nKazanilan puan: ${earnedPoints}\n${bonusText}`
    );
    setQrMessage("");
    setPendingQrId(null);
    setQrPhotoPath("");
    setWastePhotoPath("");
    setSelectedBinType(null);
    setWasteAnalysisResult(null);
    setWasteAnalysisMessage("");
    setDecodedQrText("");
    setScreen("points");
  };

  const buyStoreProduct = (product: StoreProduct) => {
    if (!currentUser) return;
    if (currentUser.totalPoints < product.pointPrice) {
      Alert.alert("Yetersiz Puan", "Bu ürün için puanınız yeterli değil.");
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === currentUser.id ? { ...user, totalPoints: user.totalPoints - product.pointPrice } : user
      )
    );
    setPurchases((prev) => [
      {
        id: `p-${Date.now()}`,
        userId: currentUser.id,
        storeProductId: product.id,
        spentPoints: product.pointPrice,
        date: new Date().toLocaleString("tr-TR"),
      },
      ...prev,
    ]);
    Alert.alert("Satın Alma Başarılı", `${product.productName} alındı. ${product.pointPrice} puan düşüldü.`);
  };

  const renderMenu = () => (
    <View style={styles.menuWrap}>
      {[
        { key: "home", label: "Ana Sayfa", icon: "🏡" },
        { key: "scanQr", label: "QR Okutma", icon: "📷" },
        { key: "points", label: "Puanlarim", icon: "⭐" },
        { key: "history", label: "Gecmis", icon: "🧾" },
        { key: "store", label: "Magaza", icon: "🛍️" },
        { key: "profile", label: "Profil", icon: "👤" },
        { key: "about", label: "Hakkinda", icon: "🌿" },
      ].map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.menuButton, screen === item.key && styles.menuButtonActive]}
          onPress={() => setScreen(item.key as AppScreen)}
        >
          <Text style={[styles.menuButtonText, screen === item.key && styles.menuButtonTextActive]}>
            {item.icon} {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const qrById = (id: string) => qrs.find((item) => item.id === id);
  const storeById = (id: string) => STORE_PRODUCTS.find((item) => item.id === id);

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.loadingWrap}>
          <Text style={styles.subtitle}>Veriler yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>♻️ DÖNGÜ</Text>
          <Text style={styles.subtitle}>Plastik geri dönüşüm puan uygulaması</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.tabButton, authMode === "login" && styles.tabButtonActive]}
                onPress={() => setAuthMode("login")}
              >
                <Text style={styles.tabText}>Giriş Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, authMode === "register" && styles.tabButtonActive]}
                onPress={() => setAuthMode("register")}
              >
                <Text style={styles.tabText}>Kayıt Ol</Text>
              </TouchableOpacity>
            </View>

            {authMode === "register" && (
              <TextInput
                placeholder="Ad Soyad"
                style={styles.input}
                value={authName}
                onChangeText={setAuthName}
              />
            )}
            <TextInput
              placeholder="E-posta"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={authEmail}
              onChangeText={setAuthEmail}
            />
            <TextInput
              placeholder="Şifre"
              style={styles.input}
              secureTextEntry
              value={authPassword}
              onChangeText={setAuthPassword}
            />

            {authMessage ? <Text style={styles.errorText}>{authMessage}</Text> : null}

            {authMode === "register" ? (
              <Button title="Kayıt Ol" onPress={handleRegister} />
            ) : (
              <Button title="Giriş Yap" onPress={handleLogin} />
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Demo QR Kodları</Text>
            {qrs.map((item) => (
              <Text key={item.id} style={styles.smallText}>
                {item.qrCode} - {item.productName} ({item.weight} puan)
              </Text>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.contentWrap}>
          <Text style={styles.title}>♻️ DÖNGÜ</Text>
          <Text style={styles.subtitle}>Hoş geldin, {currentUser.name}</Text>
          {renderMenu()}

          {screen === "home" && (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroTitle}>DÖNGÜ ile geri dönüştür, puan kazan, doğayı koru.</Text>
                <Text style={styles.heroText}>
                  Her QR tarama ile çevreye katkini arttir, puanlarını çevre dostu ödüllerde kullan.
                </Text>
                <View style={styles.quickActionRow}>
                  {quickActions.map((action) => (
                    <Pressable
                      key={action.key}
                      style={({ pressed }) => [styles.quickActionButton, pressed && styles.quickActionButtonPressed]}
                      onPress={() => setScreen(action.key)}
                    >
                      <Text style={styles.quickActionText}>
                        {action.icon} {action.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={[styles.card, styles.statCard]}>
                  <Text style={styles.statLabel}>Toplam Puan</Text>
                  <Text style={styles.statValue}>{currentUser.totalPoints}</Text>
                </View>
                <View style={[styles.card, styles.statCard]}>
                  <Text style={styles.statLabel}>Aktif QR</Text>
                  <Text style={styles.statValue}>{qrs.filter((item) => item.isActive).length}</Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>🌱 Cevre Ipuclari</Text>
                <View style={styles.tipsBox}>
                  <Text style={styles.tipText}>♻️ Atıkları yere değil kutuya atın.</Text>
                  <Text style={styles.tipText}>💚 Geri dönüşüm kutusunu seçerek daha fazla puan kazanın.</Text>
                  <Text style={styles.tipText}>🌍 Doğru geri dönüşüm çevreye katkı sağlar.</Text>
                </View>
              </View>
            </>
          )}

          {screen === "scanQr" && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📷 QR Okutma</Text>
              <Text style={styles.smallText}>
                1) Once ürünün içindeki QR görüntüsünü yükleyin veya çekin.
              </Text>
              <Text style={styles.hintText}>
                Mobilde kamera açılabilir, masaüstünde dosya seçmeniz gerekebilir.
              </Text>
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  Bilgi: Atığı geri dönüşüm kutusuna atarsanız ekstra puan (2x) kazanırsınız.
                </Text>
              </View>
              {Platform.OS === "web" ? (
                <View style={styles.spacing}>
                  <HtmlInput
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event: any) => handleWebFileChange(event, "qr")}
                    style={styles.webFileInput}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.spacing}>
                    <Button title="QR için Galeriden Fotoğraf Yükle" onPress={() => pickFromGallery("qr")} />
                  </View>
                  <View style={styles.spacing}>
                    <Button title="QR için Kamera ile Fotoğraf Çek" onPress={() => captureWithCamera("qr")} />
                  </View>
                </>
              )}
              {qrPhotoPath ? <Image source={{ uri: qrPhotoPath }} style={styles.previewImage} /> : null}
              {isDecodingQr ? <Text style={styles.infoText}>QR okunuyor...</Text> : null}
              {qrMessage ? <Text style={styles.infoText}>{qrMessage}</Text> : null}
              {decodedQrText ? <Text style={styles.text}>Okunan QR: {decodedQrText}</Text> : null}
              {qrErrorLogs.length > 0 ? (
                <View style={styles.errorPanel}>
                  <Text style={styles.errorPanelTitle}>Son QR Deneme Hataları</Text>
                  {qrErrorLogs.map((log) => (
                    <View key={log.id} style={styles.errorLogItem}>
                      <Text style={styles.errorLogReason}>{log.reason}</Text>
                      <Text style={styles.errorLogDate}>{log.date}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {pendingQr ? (
                <Text style={[styles.smallText, styles.spacingTop]}>
                  2) QR geçerli. Ürün: {pendingQr.productName} | Temel puan: {pendingQr.weight} | Tur:{" "}
                  {pendingQr.productType}. Şimdi atığı kutuya attığınızı gösteren fotoğraf yükleyin.
                </Text>
              ) : (
                <Text style={[styles.smallText, styles.spacingTop]}>
                  Once QR doğrulanmadan fotograf adımına geçilemez.
                </Text>
              )}

              {pendingQr ? (
                <>
                  {Platform.OS === "web" ? (
                    <View style={styles.spacing}>
                      <HtmlInput
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event: any) => handleWebFileChange(event, "waste")}
                        style={styles.webFileInput}
                      />
                    </View>
                  ) : (
                    <>
                      <View style={styles.spacing}>
                        <Button title="Atık için Galeriden Fotoğraf Yükle" onPress={() => pickFromGallery("waste")} />
                      </View>
                      <View style={styles.spacing}>
                        <Button title="Atık için Kamera ile Fotoğraf Çek" onPress={() => captureWithCamera("waste")} />
                      </View>
                    </>
                  )}
                  {wastePhotoPath ? (
                    <Image source={{ uri: wastePhotoPath }} style={styles.previewImage} />
                  ) : null}
                  {isAnalyzingWastePhoto ? <Text style={styles.infoText}>Atık fotoğrafı analiz ediliyor...</Text> : null}
                  {wasteAnalysisMessage ? <Text style={styles.infoText}>{wasteAnalysisMessage}</Text> : null}
                  <Text style={styles.smallText}>3) Atığı attığınız kutu tipini secin:</Text>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[
                        styles.choiceButton,
                        selectedBinType === "normal" && styles.choiceButtonNormalActive,
                      ]}
                      onPress={() => setSelectedBinType("normal")}
                    >
                      <Text style={styles.choiceText}>🗑️ Normal Çöp Kutusu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.choiceButton,
                        selectedBinType === "recycle" && styles.choiceButtonRecycleActive,
                      ]}
                      onPress={() => setSelectedBinType("recycle")}
                    >
                      <Text style={styles.choiceText}>♻️ Geri Dönüşüm Kutusu (2x)</Text>
                    </TouchableOpacity>
                  </View>
                  {selectedBinType === "recycle" ? (
                    <Text style={styles.bonusText}>Harika seçim! Bu işlemde 2x puan kazanacaksınız.</Text>
                  ) : null}
                  <Button title="Gönder ve puan kazan" onPress={completeRecycleFlow} />
                </>
              ) : null}
            </View>
          )}

          {screen === "points" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⭐ Puanlarım</Text>
            <Text style={styles.bigPoints}>{currentUser.totalPoints}</Text>
            <Text style={styles.text}>1 gram = 1 puan mantığıyla hesaplanır.</Text>
            {lastRecycleSummary ? (
              <View style={styles.resultCard}>
                <Text style={styles.textStrong}>Son İşlem Sonucu</Text>
                <Text style={styles.smallText}>
                  Kutu tipi:{" "}
                  {lastRecycleSummary.binType === "recycle" ? "Geri Dönüşüm Kutusu" : "Normal Çöp Kutusu"}
                </Text>
                <Text style={styles.smallText}>Temel puan: {lastRecycleSummary.basePoints}</Text>
                <Text style={styles.smallText}>Kazanılan puan: {lastRecycleSummary.earnedPoints}</Text>
                <Text style={styles.smallText}>Analiz sonucu: {lastRecycleSummary.analysisResult}</Text>
                {lastRecycleSummary.binType === "recycle" ? (
                  <Text style={styles.bonusText}>2x puan kazandınız! 🎉</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        )}

          {screen === "history" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🧾 Geçmiş İşlemler</Text>
            <Text style={styles.text}>Geri Dönüşüm İşlemleri</Text>
            {userTransactions.length === 0 ? (
              <Text style={styles.smallText}>Henüz işlem yok.</Text>
            ) : (
              userTransactions.map((item) => {
                const qr = qrById(item.qrId);
                return (
                  <View key={item.id} style={styles.listItem}>
                    <Text style={styles.smallText}>
                      {qr?.productName ?? "Urun"} ({item.qrCode ?? "-"})
                    </Text>
                    <Text style={styles.smallText}>
                      Kutu: {item.binType === "recycle" ? "Geri Dönüşüm" : "Normal"} | Temel:{" "}
                      {item.basePoints ?? item.earnedPoints} | Kazanılan: {item.earnedPoints}
                    </Text>
                    <Text style={styles.smallText}>Analiz sonucu: {item.analysisResult ?? "unknown"}</Text>
                    <Text style={styles.smallMuted}>{item.date}</Text>
                  </View>
                );
              })
            )}

            <Text style={[styles.text, styles.spacingTop]}>Satın Almalar</Text>
            {userPurchases.length === 0 ? (
              <Text style={styles.smallText}>Henüz satın alma yok.</Text>
            ) : (
              userPurchases.map((item) => {
                const product = storeById(item.storeProductId);
                return (
                  <View key={item.id} style={styles.listItem}>
                    <Text style={styles.smallText}>
                      {product?.productName ?? "Ürün"} - -{item.spentPoints} puan
                    </Text>
                    <Text style={styles.smallMuted}>{item.date}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

          {screen === "store" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🛍️ Mağaza</Text>
            <View style={styles.storeInfoBox}>
              <Text style={styles.storeInfoTitle}>Doğaya Katkı Köşesi</Text>
              <Text style={styles.storeInfoText}>
                Puanlarını çevre dostu ürünlerde kullanarak geri dönüşüm etkini artırabilirsin.
              </Text>
              <Text style={styles.storeInfoText}>♻️ Her geri dönüşüm adımı doğa için bir yatırımdır.</Text>
            </View>
            <View style={styles.productGrid}>
              {STORE_PRODUCTS.map((product) => (
                <View key={product.id} style={[styles.productCard, { width: productCardWidth }]}>
                  <View style={styles.productImageWrap}>
                    <Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover" />
                  </View>
                  <Text style={styles.textStrong}>{product.productName}</Text>
                  <Text style={styles.smallText}>{product.description}</Text>
                  <Text style={styles.text}>{product.pointPrice} puan</Text>
                  <Text style={styles.productHintText}>💚 Çevre dostu seçim: daha az atık, daha temiz gelecek.</Text>
                  <Button title="Satın Al" onPress={() => buyStoreProduct(product)} />
                </View>
              ))}
            </View>
          </View>
        )}

          {screen === "profile" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>👤 Profil</Text>
            <Text style={styles.text}>Ad: {currentUser.name}</Text>
            <Text style={styles.text}>E-posta: {currentUser.email}</Text>
            <Text style={styles.text}>Toplam Puan: {currentUser.totalPoints}</Text>
            <View style={styles.spacing}>
              <Button title="Çıkış Yap" color="#D9534F" onPress={handleLogout} />
            </View>
          </View>
        )}

          {screen === "about" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🌿 DONGU Nedir?</Text>
            <Text style={styles.text}>
              DÖNGÜ, geri dönüşümü teşvik eden ve kullanıcıyı çevre dostu davranışları için ödüllendiren
              bir uygulamadır. Kullanıcılar ürün üzerindeki QR kodunu okutup atığı doğru şekilde bertaraf
              ettiklerini belgeleyerek puan kazanır. Bu sistemin amacı, geri dönüşüm alışkanlığını
              yaygınlaştırmak, çevre bilincini artırmak ve sürdürülebilir bir yaşam kültürünü desteklemektir.
            </Text>
          </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EDF7F0",
  },
  container: {
    padding: 16,
    paddingBottom: 36,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#145A32",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#2F7D4A",
    marginBottom: 14,
  },
  heroCard: {
    backgroundColor: "#DFF4E5",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#C4E8CF",
    shadowColor: "#0E3A1D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  heroTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
    color: "#1A6336",
    marginBottom: 6,
  },
  heroText: {
    fontSize: 14,
    color: "#2A6D41",
    marginBottom: 10,
  },
  quickActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickActionButton: {
    backgroundColor: "#1E8E4F",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  quickActionButtonPressed: {
    opacity: 0.85,
  },
  quickActionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 160,
  },
  statLabel: {
    fontSize: 12,
    color: "#5D7A67",
    marginBottom: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1E8E4F",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2EFE5",
    shadowColor: "#0F2F1D",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B5E20",
    marginBottom: 8,
  },
  text: {
    fontSize: 15,
    color: "#263238",
    marginBottom: 6,
  },
  textStrong: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B5E20",
    marginBottom: 4,
  },
  smallText: {
    fontSize: 13,
    color: "#455A64",
    marginBottom: 4,
  },
  smallMuted: {
    fontSize: 12,
    color: "#7A8A92",
  },
  input: {
    borderWidth: 1,
    borderColor: "#C8E6C9",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FAFFFB",
  },
  errorText: {
    color: "#C62828",
    marginBottom: 10,
  },
  infoText: {
    color: "#2E7D32",
    marginTop: 10,
    fontWeight: "500",
  },
  hintText: {
    fontSize: 12,
    color: "#546E7A",
    marginBottom: 8,
  },
  webFileInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#C8E6C9",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#FAFFFB",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  tabButton: {
    flex: 1,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#81C784",
  },
  tabText: {
    color: "#1B5E20",
    fontWeight: "600",
  },
  menuWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  menuButton: {
    backgroundColor: "#E5F4EA",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D0EAD9",
  },
  menuButtonActive: {
    backgroundColor: "#1E8E4F",
    borderColor: "#1E8E4F",
  },
  menuButtonText: {
    color: "#1B5E20",
    fontSize: 12,
    fontWeight: "600",
  },
  menuButtonTextActive: {
    color: "#FFFFFF",
  },
  previewImage: {
    width: "100%",
    height: 190,
    borderRadius: 12,
    marginVertical: 10,
  },
  bigPoints: {
    fontSize: 36,
    fontWeight: "800",
    color: "#2E7D32",
    marginBottom: 6,
  },
  spacing: {
    marginBottom: 10,
  },
  spacingTop: {
    marginTop: 10,
  },
  listItem: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  productCard: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FAFFFB",
    alignSelf: "stretch",
    maxWidth: 420,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  productImageWrap: {
    width: "100%",
    aspectRatio: 16 / 10,
    maxHeight: 220,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E8F5E9",
    marginBottom: 8,
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  errorPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    backgroundColor: "#FFF7F7",
    borderRadius: 8,
    padding: 8,
  },
  errorPanelTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B71C1C",
    marginBottom: 6,
  },
  errorLogItem: {
    borderTopWidth: 1,
    borderTopColor: "#FFEBEE",
    paddingTop: 6,
    marginTop: 6,
  },
  errorLogReason: {
    fontSize: 12,
    color: "#C62828",
  },
  errorLogDate: {
    fontSize: 11,
    color: "#8D6E63",
    marginTop: 2,
  },
  tipsBox: {
    marginTop: 8,
    backgroundColor: "#F1F8E9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCEDC8",
    padding: 10,
  },
  tipText: {
    fontSize: 12,
    color: "#33691E",
    marginBottom: 4,
  },
  infoBanner: {
    backgroundColor: "#E8F5E9",
    borderColor: "#A5D6A7",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  infoBannerText: {
    fontSize: 12,
    color: "#2E7D32",
    fontWeight: "600",
  },
  choiceButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#F9FFF9",
  },
  choiceButtonNormalActive: {
    borderColor: "#90A4AE",
    backgroundColor: "#ECEFF1",
  },
  choiceButtonRecycleActive: {
    borderColor: "#66BB6A",
    backgroundColor: "#E8F5E9",
  },
  choiceText: {
    fontSize: 12,
    color: "#1B5E20",
    fontWeight: "600",
  },
  bonusText: {
    fontSize: 12,
    color: "#2E7D32",
    fontWeight: "700",
    marginBottom: 8,
  },
  resultCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    backgroundColor: "#F1F8E9",
  },
  storeInfoBox: {
    backgroundColor: "#F1F8E9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C5E1A5",
    padding: 10,
    marginBottom: 10,
  },
  storeInfoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#33691E",
    marginBottom: 4,
  },
  storeInfoText: {
    fontSize: 12,
    color: "#4E6B3A",
    marginBottom: 3,
  },
  productHintText: {
    fontSize: 12,
    color: "#2E7D32",
    marginBottom: 8,
    fontWeight: "600",
  },
});

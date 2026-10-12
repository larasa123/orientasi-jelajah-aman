import { router, useFocusEffect } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Button,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SearchBox from "../../components/SearchBox";
import WeatherCard from "../../components/WeatherCard";
import AtribusiCuaca from "../../components/AtribusiCuaca";

import { useDebounce } from "../../hooks/use-debounce";
import { cariKota } from "../../services/geocodingService";
import { ambilCuaca } from "../../services/weatherService";
import { ambilKualitasUdara } from "../../services/airQualityService";
import { konversiTingkatAQI } from "../../services/weatherAdapter";
import {
  mintaIzinLokasi,
  ambilKoordinatSaatIni,
} from "../../services/locationService";
import { labelKodeCuaca } from "../../constants/weatherCodes";
import { ambilSemuaFavorit } from "../../services/favoritStorage";

import { HasilGeocoding } from "../../types/geocoding";
import {
  DataCuacaLengkap,
  DataKualitasUdara,
} from "../../types/weather";
import { KotaFavorit } from "../../types/favorit";

export default function HalamanUtama() {
  const [teksCari, setTeksCari] = useState("");

  const [hasilPencarian, setHasilPencarian] = useState<
    HasilGeocoding[]
  >([]);

  const [kotaTerpilih, setKotaTerpilih] =
    useState<HasilGeocoding | null>(null);

  const [cuaca, setCuaca] =
    useState<DataCuacaLengkap | null>(null);

  const [kualitasUdara, setKualitasUdara] =
    useState<DataKualitasUdara | null>(null);

  const [daftarFavorit, setDaftarFavorit] =
    useState<KotaFavorit[]>([]);

  const [sedangMemuat, setSedangMemuat] = useState(false);

  const [pesanError, setPesanError] =
    useState<string | null>(null);

  const [pesanLokasi, setPesanLokasi] =
    useState<string | null>(null);

  const teksTertunda = useDebounce(teksCari, 500);

  // Mencegah hasil permintaan lama menimpa hasil terbaru
  const requestIdRef = useRef(0);

  // Memuat ulang daftar favorit saat halaman Beranda aktif
  useFocusEffect(
    useCallback(() => {
      let masihAktif = true;

      ambilSemuaFavorit()
        .then((favorit) => {
          if (masihAktif) {
            setDaftarFavorit(favorit);
          }
        })
        .catch(() => {
          if (masihAktif) {
            setDaftarFavorit([]);
          }
        });

      return () => {
        masihAktif = false;
      };
    }, [])
  );

  // Mengecek apakah kota terpilih sudah menjadi favorit
  const sudahFavorit =
    kotaTerpilih !== null &&
    daftarFavorit.some(
      (kota) => kota.id === kotaTerpilih.id
    );

  useEffect(() => {
    if (teksTertunda.trim().length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasilPencarian([]);
      return;
    }

    cariKota(teksTertunda)
      .then(setHasilPencarian)
      .catch(() => setHasilPencarian([]));
  }, [teksTertunda]);

  async function pilihKota(kota: HasilGeocoding) {
    setKotaTerpilih(kota);

    const idSaatIni = ++requestIdRef.current;

    setSedangMemuat(true);
    setPesanError(null);

    try {
      const [dataCuaca, dataAQI] = await Promise.all([
        ambilCuaca(kota.latitude, kota.longitude),
        ambilKualitasUdara(kota.latitude, kota.longitude),
      ]);

      if (idSaatIni !== requestIdRef.current) return;

      setCuaca(dataCuaca);
      setKualitasUdara(dataAQI);
    } catch {
      if (idSaatIni !== requestIdRef.current) return;

      setPesanError(
        "Gagal memuat data cuaca. Periksa koneksi internet Anda."
      );
    } finally {
      if (idSaatIni === requestIdRef.current) {
        setSedangMemuat(false);
      }
    }
  }

  async function gunakanLokasiSaatIni() {
    try {
      setPesanLokasi(null);

      const status = await mintaIzinLokasi();

      if (status === "denied") {
        setPesanLokasi(
          "Izin lokasi ditolak. Silakan cari kota secara manual di atas."
        );
        return;
      }

      if (status === "unavailable") {
        setPesanLokasi(
          "Layanan lokasi tidak aktif di perangkat ini. Silakan cari kota secara manual."
        );
        return;
      }

      const koordinat = await ambilKoordinatSaatIni();

      await pilihKota({
        id: -1,
        name: "Lokasi Saat Ini",
        latitude: koordinat.latitude,
        longitude: koordinat.longitude,
        country: "",
      });
    } catch {
      setPesanLokasi(
        "Gagal mendapatkan lokasi. Silakan cari kota secara manual."
      );
    }
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        padding: 16,
        gap: 16,
      }}
    >
      <SearchBox onCari={setTeksCari} />

      <Button
        title="Gunakan Lokasi Saat Ini"
        onPress={gunakanLokasiSaatIni}
      />

      {pesanLokasi && (
        <Text style={{ color: "red" }}>
          {pesanLokasi}
        </Text>
      )}

      {hasilPencarian.map((kota) => (
        <TouchableOpacity
          key={kota.id}
          onPress={() => pilihKota(kota)}
        >
          <Text>{kota.name}</Text>
        </TouchableOpacity>
      ))}

      {sedangMemuat && <ActivityIndicator />}

      {pesanError && (
        <View>
          <Text>{pesanError}</Text>

          <Button
            title="Coba Lagi"
            onPress={() =>
              kotaTerpilih && pilihKota(kotaTerpilih)
            }
          />
        </View>
      )}

      {cuaca &&
        kualitasUdara &&
        kotaTerpilih &&
        !sedangMemuat && (
          <>
            <WeatherCard
              kota={kotaTerpilih.name}
              suhu={cuaca.saatIni.suhu}
              tingkatAQI={konversiTingkatAQI(
                kualitasUdara.indeksAQI
              )}
              indeksAQI={kualitasUdara.indeksAQI}
            />

            {!sudahFavorit && (
              <Button
                title="Tambahkan ke Favorit"
                onPress={() =>
                  router.push({
                    pathname: "/tambah-favorit",
                    params: {
                      id: String(kotaTerpilih.id),
                      nama: kotaTerpilih.name,
                      lat: String(kotaTerpilih.latitude),
                      lon: String(kotaTerpilih.longitude),
                    },
                  })
                }
              />
            )}

            {sudahFavorit && (
              <Text style={{ color: "green" }}>
                Kota ini sudah tersimpan di favorit.
              </Text>
            )}
          </>
        )}

      {cuaca && (
        <Text>
          Suhu hari ini: {cuaca.harian.suhuMinimal[0]}°C -{" "}
          {cuaca.harian.suhuMaksimal[0]}°C
        </Text>
      )}

      {cuaca && (
        <Text style={{ fontSize: 12, color: "#888" }}>
          Kondisi: {labelKodeCuaca(cuaca.saatIni.kodeCuaca)} •
          Angin {cuaca.saatIni.kecepatanAngin} km/j
        </Text>
      )}

      {kualitasUdara && (
        <Text style={{ fontSize: 12, color: "#888" }}>
          PM2.5: {kualitasUdara.pm25} • PM10: {kualitasUdara.pm10}
        </Text>
      )}

      <AtribusiCuaca />
    </SafeAreaView>
  );
}
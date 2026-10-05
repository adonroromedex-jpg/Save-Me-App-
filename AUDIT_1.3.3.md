# Verifikasyon demann Save Me — 1.3.3

Dat: 5 oktòb 2026. Sa a se yon revizyon kòd ak tès otomatik. Li pa vle di tout fonksyon yo verifye sou SM_S911U1 ak SM_S921U. 1.3.3 poko enstale sou telefòn yo nan moman revizyon sa a.

| Demann | Sa ki nan kòd la | Sa ki rete / limit |
|---|---|---|
| Tèks, vokal, foto, videyo | Echanj chifre ak lekti/lektè medya | Tès de telefòn apre patch la |
| Vokal fasil pou koute | Dechifreman otomatik pou patisipan yo; kadna retire nan vokal nan 1.3.3 | Vokal pa mande PIN, menm jan ak tèks; li toujou chifre |
| Foto/videyo chat efase apre 24h | Ekspirasyon baze sou lè sèvè a aksepte anvwa; verifikasyon sou entènèt pou ouvri | Retire aksè egzakteman nan ekspirasyon; efasman fizik sou telefòn etenn pa ka garanti |
| Vault pèsonèl rete chifre | Fichye orijinal Vault yo rete; yon sèl PIN Vault, diferan ak PIN medya chat | Pa gen rekiperasyon kle Vault pèdi apre dezenstalasyon |
| Kamera prive ak videyo 3 minit | Kamera app la; limit 180 segonn; kopi tanporè nan cache prive | Galri orijinal itilizatè a pa efase apre enpòtasyon |
| Move kòd pa fè pèdi foto/videyo a | Menm seleksyon an rete pandan prompt la pou re-eseye | Anile/sòti pandan operasyon an ka retire kopi tanporè a pou sekirite |
| Vault → chat | Meni atachman → Vault → PIN Vault → PIN pou kopi chat la | Orijinal Vault la rete |
| Vitès medya | Crypto Android natif; 3 transfè an paralèl; 1.3.3 gwoupe lyen kout dire pou 24 pati, sispann polling chat pandan transfè, evite repete erè ansyen kle | Bezwen mezi reyèl sou telefòn yo; pa gen garanti vitès, streaming videyo oswa nouvo konpresyon videyo |
| Pwogrè transfè | Faz/pousantaj parèt nan prompt kòd la nan 1.3.3; mezi dire nan Settings | Konpare menm fichye sou menm rezo anvan/apre |
| Splash Welcome / SaveMe please | Imaj ak animasyon 3 segonn egziste | Itilizatè a di ajisteman an poko bon: bezwen foto ekran an ak lòt telefòn. Son splash la poko ajoute paske fichye son an pa disponib |
| Kontak / enskripsyon senp | Yon sèl nimewo ak indicatif; rechèch nimewo/kontak; validasyon | Nimewo pa verifye pa SMS; kont diferan pa fusionnen otomatikman |
| Footer ak meni | Navigasyon ble ak ikon; ansyen bande/bouton doub retire | Aparans sou aparèy dwe revize ak itilizatè a |
| Pwofil | Non/foto modifyab; telefòn/imèl readonly; non/foto Home; ti foto nan vokal | Nimewo ki deja pou yon lòt kont rete pou kont sa a; pa gen transfè nimewo otomatik |
| Pop-up | Dyalòg pèsonalize nan fenèt sekirize app la | Ekran sistèm biyometri/pèmisyon se Android ki kontwole yo |
| Konfimasyon imèl | Espas anba eksplikasyon an ogmante nan 1.3.3; pwoteksyon kont plizyè peze Verify | SMS/WhatsApp kòm chwa pou OTP poko enplemante |
| Notifikasyon / badge | Realtime, notifikasyon lokal, kontè non-li ak netwayaj apre lekti; ansyen jenerasyon kle pa kenbe badge kole | Push lè app fèmen toujou mande konfigirasyon FCM/Expo ak sèvis sèvè; pa verifye kòm deplwaye |
| Akize resepsyon | 1 check aksepte sèvè, 2 check aparèy konfime, koulè lè li/ouvri | Pa konfonn push ak lekti |
| Siprime mesaj | Tèks pwòp sender a sèlman, pou toude patisipan | Foto/videyo/vokal pa gen menm bouton sipresyon sa a |
| Avètisman 24h | Premye anvwa kache eksplikasyon an; nouvo avètisman lè medya gen mwens pase 1h | Ekspirasyon se pou chak medya, pa yon sèl dat pou tout chat la |
| Ansyen chat apre rekoneksyon | Threads pèmanan pou menm ID kont; list/pagination mesaj | Kont diferan ak menm non se pa menm kont; ansyen chifreman pa rekiperab si kle pèdi |
| Rekòmansman apre dezenstalasyon | OTP resan, nouvo kle konsève anvan sèvè, konfimasyon kle kontak | Itilizatè a konfime li te jwenn solisyon an; pa rekipere ansyen kle |
| Biyometri chak retou | 1.3.3 retire delè 30s: background fèmen aksè; anprent/figi obligatwa, pa fallback PIN | Biyometri dwe enskri nan paramèt telefòn nan. Tès sistèm picker/rekoneksyon sou de telefòn rete obligatwa |
| Chanje kont sou menm aparèy | Kle/Vault/PIN namespace pa ID kont; logout konsève kle; done UI vid pou nouvo kont; operasyon ansyen kont rejte | Pa dezenstale / efase done; multi-device pou menm kont toujou pa sipòte |

## Sa pou mezire sou aparèy yo

- Vèsyon 1.3.3 / versionCode 7 ak crypto natif aktif nan Settings.
- Menm foto/videyo anvan/apre: gwosè MB, dire preparasyon, transfè ak validasyon pou sender ak receiver.
- Background epi retounen touswit: kontni kache jiskaske biyometri reyisi. Annile biyometri dwe kite app la bloke.
- Galri → chwazi yon imaj → retounen → biyometri → menm seleksyon an toujou disponib.
- Kont A → logout → kont B → logout → kont A: non, foto, Vault ak chat yo pa melanje; A kenbe kle li.
- Foto splash la ak yon lòt telefòn, paske app la anpeche screenshot.

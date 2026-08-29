# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\mobile-web\apply_job_noCV_flow.mobile.spec.js >> Mobile Feature: Hoàn thành profile mini và ứng tuyển job không cần CV @applyjob @mobile @e2e >> Người dùng mobile hoàn thành tạo profile và ứng tuyển job không cần CV
- Location: tests\e2e\mobile-web\apply_job_noCV_flow.mobile.spec.js:6:3

# Error details

```
TimeoutError: locator.waitFor: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.job-list-mobile, .job-list') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e8]:
        - link [ref=e10] [cursor=pointer]:
          - /url: /
          - img [ref=e11]
        - generic [ref=e19]:
          - button "" [ref=e23] [cursor=pointer]:
            - generic [ref=e24]: 
          - figure [ref=e26] [cursor=pointer]:
            - img "avt_invalid" [ref=e27]
    - generic [ref=e28]:
      - generic [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e31]: 
          - textbox "" [ref=e32]:
            - /placeholder: Tìm kiếm cơ hội việc làm
        - text:     
      - navigation [ref=e34]:
        - list [ref=e35]:
          - listitem [ref=e36]:
            - link "Trang chủ" [ref=e37] [cursor=pointer]:
              - /url: https://seeker.vl24hv2.qc.sieuviet-team.com/
            - generic [ref=e38]: /
          - listitem [ref=e39]:
            - link "Tìm kiếm việc làm" [ref=e40] [cursor=pointer]:
              - /url: https://seeker.vl24hv2.qc.sieuviet-team.com/tim-kiem-viec-lam-nhanh
            - generic [ref=e41]: /
          - listitem [ref=e42]: Tuyển dụng 1,596 việc làm mới nhất năm 2026
      - generic [ref=e44]:
        - generic [ref=e45]:
          - generic [ref=e46]: "1596"
          - text: tin đăng
        - generic [ref=e47]:
          - generic [ref=e48]:
            - generic [ref=e49]: "1"
            - generic [ref=e50]: 
          - generic [ref=e51]: Lọc kết quả
    - generic [ref=e52]:
      - generic [ref=e54]:
        - text: 
        - generic [ref=e56]:
          - heading "Bán hàng - Kinh doanh" [level=3] [ref=e58] [cursor=pointer]:
            - link "Bán hàng - Kinh doanh" [ref=e59]:
              - /url: /viec-lam-ban-hang-kinh-doanh-o13.html
          - heading "Bán sỉ - Bán lẻ - Quản lý cửa hàng" [level=3] [ref=e62] [cursor=pointer]:
            - link "Bán sỉ - Bán lẻ - Quản lý cửa hàng" [ref=e63]:
              - /url: /viec-lam-ban-si-ban-le-quan-ly-cua-hang-o6.html
          - heading "Marketing" [level=3] [ref=e66] [cursor=pointer]:
            - link "Marketing" [ref=e67]:
              - /url: /viec-lam-marketing-o12.html
          - heading "Hành chính - Thư ký" [level=3] [ref=e70] [cursor=pointer]:
            - link "Hành chính - Thư ký" [ref=e71]:
              - /url: /viec-lam-hanh-chinh-thu-ky-o1.html
          - heading "Vận hành - Bảo trì - Bảo dưỡng" [level=3] [ref=e74] [cursor=pointer]:
            - link "Vận hành - Bảo trì - Bảo dưỡng" [ref=e75]:
              - /url: /viec-lam-van-hanh-bao-tri-bao-duong-o10.html
          - heading "Kế toán" [level=3] [ref=e78] [cursor=pointer]:
            - link "Kế toán" [ref=e79]:
              - /url: /viec-lam-ke-toan-o17.html
      - generic [ref=e81]: 
    - button "Tìm việc làm gần tôi " [ref=e83] [cursor=pointer]:
      - generic [ref=e84]: Tìm việc làm gần tôi
      - generic [ref=e85]: 
    - main [ref=e86]:
      - generic [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e93]:
            - generic [ref=e95]:
              - button " Tạo thông báo việc làm" [ref=e96] [cursor=pointer]:
                - generic [ref=e97]: 
                - generic [ref=e98]: Tạo thông báo việc làm
              - generic [ref=e100] [cursor=pointer]: 
            - button " Đã lưu (0)" [ref=e101] [cursor=pointer]:
              - generic [ref=e102]: 
              - text: Đã lưu (0)
          - generic [ref=e104]:
            - generic [ref=e105]: "Sắp xếp theo:"
            - generic [ref=e106]:
              - heading "Phù hợp nhất" [level=2] [ref=e107]:
                - button "Phù hợp nhất" [ref=e108] [cursor=pointer]:
                  - text: Phù hợp nhất
                  - img [ref=e109]
              - heading "Mới nhất" [level=2] [ref=e110]:
                - button "Mới nhất" [ref=e111] [cursor=pointer]
        - generic [ref=e112]:
          - link "Digital Product Owner  Cty MTV QC Nanomax 22 - 24 triệu  TP.HCM Không cần CV  Còn 1343 ngày" [ref=e113] [cursor=pointer]:
            - /url: /thuc-tap-sinh/digital-product-owner-c53p122id200781431.html?open_from=0201_1_1&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e114]:
              - generic [ref=e115]:
                - generic [ref=e116]:
                  - figure [ref=e117]:
                    - img "Cty MTV QC Nanomax" [ref=e118]
                  - generic [ref=e119]:
                    - generic [ref=e120]:
                      - heading "Digital Product Owner" [level=3] [ref=e122]
                      - generic [ref=e123]: 
                    - heading "Cty MTV QC Nanomax" [level=3] [ref=e124]
                - generic [ref=e125]:
                  - generic [ref=e127]: 22 - 24 triệu
                  - generic [ref=e130]:
                    - generic [ref=e131]: 
                    - generic [ref=e132]: TP.HCM
              - generic [ref=e133]:
                - generic [ref=e135]: Không cần CV
                - generic [ref=e137]:
                  - generic [ref=e138]: 
                  - generic [ref=e139]: Còn 1343 ngày
          - link " Nhân Viên Nhắc Phí – Công Việc Văn Phòng – Thu Nhập Ổn Định No-Cv  Dl-DV-ĐT-Thinh-Vuong 9 - 25 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e140] [cursor=pointer]:
            - /url: /hanh-chinh-thu-ky/nhan-vien-nhac-phi-cong-viec-van-phong-thu-nhap-on-dinh-no-cv-c1p122id200811875.html?open_from=0201_1_2&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e141]:
              - generic [ref=e142]:
                - generic [ref=e143]:
                  - figure [ref=e144]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e146]
                  - generic [ref=e147]:
                    - generic [ref=e148]:
                      - heading " Nhân Viên Nhắc Phí – Công Việc Văn Phòng – Thu Nhập Ổn Định No-Cv" [level=3] [ref=e150]:
                        - generic [ref=e153]: 
                        - text: Nhân Viên Nhắc Phí – Công Việc Văn Phòng – Thu Nhập Ổn Định No-Cv
                      - generic [ref=e154]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e155]
                - generic [ref=e156]:
                  - generic [ref=e158]: 9 - 25 triệu
                  - generic [ref=e161]:
                    - generic [ref=e162]: 
                    - generic [ref=e163]: TP.HCM
              - generic [ref=e164]:
                - generic [ref=e165]:
                  - generic [ref=e167]: Phản hồi trong 48 giờ
                  - generic [ref=e168]: Không cần CV
                - generic [ref=e170]:
                  - generic [ref=e171]: 
                  - generic [ref=e172]: Còn 5 ngày
          - link " Lao Động Phổ Thông (Nam) No-Cv  Dl-DV-ĐT-Thinh-Vuong 8 - 10 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e173] [cursor=pointer]:
            - /url: /lao-dong-pho-thong/lao-dong-pho-thong-nam-no-cv-c49p122id200811910.html?open_from=0201_1_3&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e174]:
              - generic [ref=e175]:
                - generic [ref=e176]:
                  - figure [ref=e177]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e179]
                  - generic [ref=e180]:
                    - generic [ref=e181]:
                      - heading " Lao Động Phổ Thông (Nam) No-Cv" [level=3] [ref=e183]:
                        - generic [ref=e186]: 
                        - text: Lao Động Phổ Thông (Nam) No-Cv
                      - generic [ref=e187]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e188]
                - generic [ref=e189]:
                  - generic [ref=e191]: 8 - 10 triệu
                  - generic [ref=e194]:
                    - generic [ref=e195]: 
                    - generic [ref=e196]: TP.HCM
              - generic [ref=e197]:
                - generic [ref=e198]:
                  - generic [ref=e200]: Phản hồi trong 48 giờ
                  - generic [ref=e201]: Không cần CV
                - generic [ref=e203]:
                  - generic [ref=e204]: 
                  - generic [ref=e205]: Còn 5 ngày
          - link " Công Nhân (Lao Động Phổ Thông) No-Cv  Công Ty TNHH Taigerich 7 - 9 triệu  Bình Dương Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e206] [cursor=pointer]:
            - /url: /san-xuat-lap-rap-che-bien/cong-nhan-lao-dong-pho-thong-no-cv-c9p119id200812030.html?open_from=0201_1_4&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e207]:
              - generic [ref=e208]:
                - generic [ref=e209]:
                  - figure [ref=e210]:
                    - img "Công Ty TNHH Taigerich" [ref=e212]
                  - generic [ref=e213]:
                    - generic [ref=e214]:
                      - heading " Công Nhân (Lao Động Phổ Thông) No-Cv" [level=3] [ref=e216]:
                        - generic [ref=e219]: 
                        - text: Công Nhân (Lao Động Phổ Thông) No-Cv
                      - generic [ref=e220]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e221]
                - generic [ref=e222]:
                  - generic [ref=e224]: 7 - 9 triệu
                  - generic [ref=e227]:
                    - generic [ref=e228]: 
                    - generic [ref=e229]: Bình Dương
              - generic [ref=e230]:
                - generic [ref=e231]:
                  - generic [ref=e233]: Phản hồi trong 48 giờ
                  - generic [ref=e234]: Không cần CV
                - generic [ref=e236]:
                  - generic [ref=e237]: 
                  - generic [ref=e238]: Còn 5 ngày
          - link " Nhân Viên Kinh Doanh Thị Trường No-Cv  Công Ty TNHH Taigerich 8 - 12 triệu  Bình Dương, TP.HCM, +3 Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e239] [cursor=pointer]:
            - /url: /ban-si-ban-le-quan-ly-cua-hang/nhan-vien-kinh-doanh-thi-truong-no-cv-c6p119id200812023.html?open_from=0201_1_5&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e240]:
              - generic [ref=e241]:
                - generic [ref=e242]:
                  - figure [ref=e243]:
                    - img "Công Ty TNHH Taigerich" [ref=e245]
                  - generic [ref=e246]:
                    - generic [ref=e247]:
                      - heading " Nhân Viên Kinh Doanh Thị Trường No-Cv" [level=3] [ref=e249]:
                        - generic [ref=e252]: 
                        - text: Nhân Viên Kinh Doanh Thị Trường No-Cv
                      - generic [ref=e253]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e254]
                - generic [ref=e255]:
                  - generic [ref=e257]: 8 - 12 triệu
                  - generic [ref=e260]:
                    - generic [ref=e261]: 
                    - generic [ref=e262]: Bình Dương, TP.HCM, +3
              - generic [ref=e263]:
                - generic [ref=e264]:
                  - generic [ref=e266]: Phản hồi trong 48 giờ
                  - generic [ref=e267]: Không cần CV
                - generic [ref=e269]:
                  - generic [ref=e270]: 
                  - generic [ref=e271]: Còn 5 ngày
          - generic [ref=e272]:
            - generic [ref=e273]:
              - generic [ref=e274]: Tìm việc phù hợp hơn trong vài bước
              - generic [ref=e275]: Điền nhanh một vài thông tin để xem những công việc phù hợp hơn với bạn.
            - button "Điền nhanh" [ref=e276] [cursor=pointer]:
              - generic [ref=e277]: Điền nhanh
          - generic [ref=e278]:
            - generic [ref=e279]: Trạng thái tìm việc hiện tại của bạn?
            - generic [ref=e280]:
              - button " Sẵn sàng đi làm ngay" [ref=e281] [cursor=pointer]:
                - generic [ref=e283]: 
                - generic [ref=e284]: Sẵn sàng đi làm ngay
              - button " Đang xem xét cơ hội mới" [ref=e285] [cursor=pointer]:
                - generic [ref=e287]: 
                - generic [ref=e288]: Đang xem xét cơ hội mới
              - button " Chưa định chuyển việc" [ref=e289] [cursor=pointer]:
                - generic [ref=e291]: 
                - generic [ref=e292]: Chưa định chuyển việc
          - link " Nhân Viên Vận Hành Điểm Hỗ Trợ Đối Tác No-Cv  Công Ty TNHH Taigerich 8 - 11 triệu  Bình Dương Phản hồi trong 48 giờ Không cần CV  Còn 4 ngày" [ref=e293] [cursor=pointer]:
            - /url: /thu-mua-kho-van-chuoi-cung-ung/nhan-vien-van-hanh-diem-ho-tro-doi-tac-no-cv-c14p119id200812009.html?open_from=0201_1_6&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e294]:
              - generic [ref=e295]:
                - generic [ref=e296]:
                  - figure [ref=e297]:
                    - img "Công Ty TNHH Taigerich" [ref=e299]
                  - generic [ref=e300]:
                    - generic [ref=e301]:
                      - heading " Nhân Viên Vận Hành Điểm Hỗ Trợ Đối Tác No-Cv" [level=3] [ref=e303]:
                        - generic [ref=e306]: 
                        - text: Nhân Viên Vận Hành Điểm Hỗ Trợ Đối Tác No-Cv
                      - generic [ref=e307]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e308]
                - generic [ref=e309]:
                  - generic [ref=e311]: 8 - 11 triệu
                  - generic [ref=e314]:
                    - generic [ref=e315]: 
                    - generic [ref=e316]: Bình Dương
              - generic [ref=e317]:
                - generic [ref=e318]:
                  - generic [ref=e320]: Phản hồi trong 48 giờ
                  - generic [ref=e321]: Không cần CV
                - generic [ref=e323]:
                  - generic [ref=e324]: 
                  - generic [ref=e325]: Còn 4 ngày
          - link " Nhân Viên Kỹ Thuật Chỉnh Máy Ép Nhựa - Đi Làm Ngay No-Cv  Công Ty TNHH Taigerich 10 - 15 triệu  Bình Dương Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e326] [cursor=pointer]:
            - /url: /san-xuat-lap-rap-che-bien/nhan-vien-ky-thuat-chinh-may-ep-nhua-di-lam-ngay-no-cv-c9p119id200811988.html?open_from=0201_1_7&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e327]:
              - generic [ref=e328]:
                - generic [ref=e329]:
                  - figure [ref=e330]:
                    - img "Công Ty TNHH Taigerich" [ref=e332]
                  - generic [ref=e333]:
                    - generic [ref=e334]:
                      - heading " Nhân Viên Kỹ Thuật Chỉnh Máy Ép Nhựa - Đi Làm Ngay No-Cv" [level=3] [ref=e336]:
                        - generic [ref=e339]: 
                        - text: Nhân Viên Kỹ Thuật Chỉnh Máy Ép Nhựa - Đi Làm Ngay No-Cv
                      - generic [ref=e340]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e341]
                - generic [ref=e342]:
                  - generic [ref=e344]: 10 - 15 triệu
                  - generic [ref=e347]:
                    - generic [ref=e348]: 
                    - generic [ref=e349]: Bình Dương
              - generic [ref=e350]:
                - generic [ref=e351]:
                  - generic [ref=e353]: Phản hồi trong 48 giờ
                  - generic [ref=e354]: Không cần CV
                - generic [ref=e356]:
                  - generic [ref=e357]: 
                  - generic [ref=e358]: Còn 5 ngày
          - link " Unilever - Nhân Viên Bán Hàng Siêu Thị No-Cv  Công Ty TNHH Taigerich 11.1 - 11.6 triệu  Bình Dương, Hải Phòng, +3 Phản hồi trong 48 giờ Không cần CV  Còn 4 ngày" [ref=e359] [cursor=pointer]:
            - /url: /ban-si-ban-le-quan-ly-cua-hang/unilever-nhan-vien-ban-hang-sieu-thi-no-cv-c6p119id200811974.html?open_from=0201_1_8&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e360]:
              - generic [ref=e361]:
                - generic [ref=e362]:
                  - figure [ref=e363]:
                    - img "Công Ty TNHH Taigerich" [ref=e365]
                  - generic [ref=e366]:
                    - generic [ref=e367]:
                      - heading " Unilever - Nhân Viên Bán Hàng Siêu Thị No-Cv" [level=3] [ref=e369]:
                        - generic [ref=e372]: 
                        - text: Unilever - Nhân Viên Bán Hàng Siêu Thị No-Cv
                      - generic [ref=e373]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e374]
                - generic [ref=e375]:
                  - generic [ref=e377]: 11.1 - 11.6 triệu
                  - generic [ref=e380]:
                    - generic [ref=e381]: 
                    - generic [ref=e382]: Bình Dương, Hải Phòng, +3
              - generic [ref=e383]:
                - generic [ref=e384]:
                  - generic [ref=e386]: Phản hồi trong 48 giờ
                  - generic [ref=e387]: Không cần CV
                - generic [ref=e389]:
                  - generic [ref=e390]: 
                  - generic [ref=e391]: Còn 4 ngày
          - link " Nhân Viên Bảo Trì Sửa Chữa Xe Nâng Điện No-Cv  Công Ty TNHH Taigerich 8 - 15 triệu  Bình Dương, Hà Nội, +2 Phản hồi trong 48 giờ Không cần CV  Còn 4 ngày" [ref=e392] [cursor=pointer]:
            - /url: /co-khi-o-to-tu-dong-hoa/nhan-vien-bao-tri-sua-chua-xe-nang-dien-no-cv-c47p119id200811967.html?open_from=0201_1_9&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e393]:
              - generic [ref=e394]:
                - generic [ref=e395]:
                  - figure [ref=e396]:
                    - img "Công Ty TNHH Taigerich" [ref=e398]
                  - generic [ref=e399]:
                    - generic [ref=e400]:
                      - heading " Nhân Viên Bảo Trì Sửa Chữa Xe Nâng Điện No-Cv" [level=3] [ref=e402]:
                        - generic [ref=e405]: 
                        - text: Nhân Viên Bảo Trì Sửa Chữa Xe Nâng Điện No-Cv
                      - generic [ref=e406]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e407]
                - generic [ref=e408]:
                  - generic [ref=e410]: 8 - 15 triệu
                  - generic [ref=e413]:
                    - generic [ref=e414]: 
                    - generic [ref=e415]: Bình Dương, Hà Nội, +2
              - generic [ref=e416]:
                - generic [ref=e417]:
                  - generic [ref=e419]: Phản hồi trong 48 giờ
                  - generic [ref=e420]: Không cần CV
                - generic [ref=e422]:
                  - generic [ref=e423]: 
                  - generic [ref=e424]: Còn 4 ngày
          - link " Lao Động Phổ Thông / Công Nhân Cơ Khí - Đi Làm Ngay No-Cv  Công Ty TNHH Taigerich 8 - 15 triệu  Bình Dương, TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e425] [cursor=pointer]:
            - /url: /lao-dong-pho-thong/lao-dong-pho-thong-cong-nhan-co-khi-di-lam-ngay-no-cv-c49p119id200811960.html?open_from=0201_1_10&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e426]:
              - generic [ref=e427]:
                - generic [ref=e428]:
                  - figure [ref=e429]:
                    - img "Công Ty TNHH Taigerich" [ref=e431]
                  - generic [ref=e432]:
                    - generic [ref=e433]:
                      - heading " Lao Động Phổ Thông / Công Nhân Cơ Khí - Đi Làm Ngay No-Cv" [level=3] [ref=e435]:
                        - generic [ref=e438]: 
                        - text: Lao Động Phổ Thông / Công Nhân Cơ Khí - Đi Làm Ngay No-Cv
                      - generic [ref=e439]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e440]
                - generic [ref=e441]:
                  - generic [ref=e443]: 8 - 15 triệu
                  - generic [ref=e446]:
                    - generic [ref=e447]: 
                    - generic [ref=e448]: Bình Dương, TP.HCM
              - generic [ref=e449]:
                - generic [ref=e450]:
                  - generic [ref=e452]: Phản hồi trong 48 giờ
                  - generic [ref=e453]: Không cần CV
                - generic [ref=e455]:
                  - generic [ref=e456]: 
                  - generic [ref=e457]: Còn 5 ngày
          - link " Tài Xế Lái Xe Cho Sếp No-Cv  Công Ty TNHH Taigerich 12 - 15 triệu  Bình Dương Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e458] [cursor=pointer]:
            - /url: /van-tai-lai-xe-giao-nhan/tai-xe-lai-xe-cho-sep-no-cv-c16p119id200811953.html?open_from=0201_1_11&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e459]:
              - generic [ref=e460]:
                - generic [ref=e461]:
                  - figure [ref=e462]:
                    - img "Công Ty TNHH Taigerich" [ref=e464]
                  - generic [ref=e465]:
                    - generic [ref=e466]:
                      - heading " Tài Xế Lái Xe Cho Sếp No-Cv" [level=3] [ref=e468]:
                        - generic [ref=e471]: 
                        - text: Tài Xế Lái Xe Cho Sếp No-Cv
                      - generic [ref=e472]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e473]
                - generic [ref=e474]:
                  - generic [ref=e476]: 12 - 15 triệu
                  - generic [ref=e479]:
                    - generic [ref=e480]: 
                    - generic [ref=e481]: Bình Dương
              - generic [ref=e482]:
                - generic [ref=e483]:
                  - generic [ref=e485]: Phản hồi trong 48 giờ
                  - generic [ref=e486]: Không cần CV
                - generic [ref=e488]:
                  - generic [ref=e489]: 
                  - generic [ref=e490]: Còn 5 ngày
          - link " Thợ Điện Công Trình (Thu Nhập Đến 25 Triệu / Tháng) Tại Hà Nội Và Bình Dương No-Cv  Công Ty TNHH Taigerich 18 - 25 triệu  Bình Dương, Hà Nội Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e491] [cursor=pointer]:
            - /url: /xay-dung/tho-dien-cong-trinh-thu-nhap-den-25-trieu-thang-tai-ha-noi-va-binh-duong-no-cv-c31p119id200811946.html?open_from=0201_1_12&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e492]:
              - generic [ref=e493]:
                - generic [ref=e494]:
                  - figure [ref=e495]:
                    - img "Công Ty TNHH Taigerich" [ref=e497]
                  - generic [ref=e498]:
                    - generic [ref=e499]:
                      - heading " Thợ Điện Công Trình (Thu Nhập Đến 25 Triệu / Tháng) Tại Hà Nội Và Bình Dương No-Cv" [level=3] [ref=e501]:
                        - generic [ref=e504]: 
                        - text: Thợ Điện Công Trình (Thu Nhập Đến 25 Triệu / Tháng) Tại Hà Nội Và Bình Dương No-Cv
                      - generic [ref=e505]: 
                    - heading "Công Ty TNHH Taigerich" [level=3] [ref=e506]
                - generic [ref=e507]:
                  - generic [ref=e509]: 18 - 25 triệu
                  - generic [ref=e512]:
                    - generic [ref=e513]: 
                    - generic [ref=e514]: Bình Dương, Hà Nội
              - generic [ref=e515]:
                - generic [ref=e516]:
                  - generic [ref=e518]: Phản hồi trong 48 giờ
                  - generic [ref=e519]: Không cần CV
                - generic [ref=e521]:
                  - generic [ref=e522]: 
                  - generic [ref=e523]: Còn 5 ngày
          - link " Nhân Viên Vận Hành CNC Và Lắp Ráp Máy - Không Yêu Cầu Kinh Nghiệm No-Cv  Dl-DV-ĐT-Thinh-Vuong 8.3 - 12 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e524] [cursor=pointer]:
            - /url: /van-hanh-bao-tri-bao-duong/nhan-vien-van-hanh-cnc-va-lap-rap-may-khong-yeu-cau-kinh-nghiem-no-cv-c10p122id200811924.html?open_from=0201_1_13&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e525]:
              - generic [ref=e526]:
                - generic [ref=e527]:
                  - figure [ref=e528]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e530]
                  - generic [ref=e531]:
                    - generic [ref=e532]:
                      - heading " Nhân Viên Vận Hành CNC Và Lắp Ráp Máy - Không Yêu Cầu Kinh Nghiệm No-Cv" [level=3] [ref=e534]:
                        - generic [ref=e537]: 
                        - text: Nhân Viên Vận Hành CNC Và Lắp Ráp Máy - Không Yêu Cầu Kinh Nghiệm No-Cv
                      - generic [ref=e538]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e539]
                - generic [ref=e540]:
                  - generic [ref=e542]: 8.3 - 12 triệu
                  - generic [ref=e545]:
                    - generic [ref=e546]: 
                    - generic [ref=e547]: TP.HCM
              - generic [ref=e548]:
                - generic [ref=e549]:
                  - generic [ref=e551]: Phản hồi trong 48 giờ
                  - generic [ref=e552]: Không cần CV
                - generic [ref=e554]:
                  - generic [ref=e555]: 
                  - generic [ref=e556]: Còn 5 ngày
          - link " Kỹ Sư Cơ Khí, Điện, Ô Tô, Tự Động Hoá Làm Việc Lâu Dài Tại Nhật Bản No-Cv  Dl-DV-ĐT-Thinh-Vuong 36 - 60 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e557] [cursor=pointer]:
            - /url: /van-hanh-bao-tri-bao-duong/ky-su-co-khi-dien-o-to-tu-dong-hoa-lam-viec-lau-dai-tai-nhat-ban-no-cv-c10p122id200811917.html?open_from=0201_1_14&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e558]:
              - generic [ref=e559]:
                - generic [ref=e560]:
                  - figure [ref=e561]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e563]
                  - generic [ref=e564]:
                    - generic [ref=e565]:
                      - heading " Kỹ Sư Cơ Khí, Điện, Ô Tô, Tự Động Hoá Làm Việc Lâu Dài Tại Nhật Bản No-Cv" [level=3] [ref=e567]:
                        - generic [ref=e570]: 
                        - text: Kỹ Sư Cơ Khí, Điện, Ô Tô, Tự Động Hoá Làm Việc Lâu Dài Tại Nhật Bản No-Cv
                      - generic [ref=e571]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e572]
                - generic [ref=e573]:
                  - generic [ref=e575]: 36 - 60 triệu
                  - generic [ref=e578]:
                    - generic [ref=e579]: 
                    - generic [ref=e580]: TP.HCM
              - generic [ref=e581]:
                - generic [ref=e582]:
                  - generic [ref=e584]: Phản hồi trong 48 giờ
                  - generic [ref=e585]: Không cần CV
                - generic [ref=e587]:
                  - generic [ref=e588]: 
                  - generic [ref=e589]: Còn 5 ngày
          - link " Nhân Viên Nhắc Hẹn Thanh Toán- Đi Làm Sau Lễ- Thu Nhập 15M No-Cv  Dl-DV-ĐT-Thinh-Vuong 9 - 25 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e590] [cursor=pointer]:
            - /url: /hanh-chinh-thu-ky/nhan-vien-nhac-hen-thanh-toan-di-lam-sau-le-thu-nhap-15m-no-cv-c1p122id200811896.html?open_from=0201_1_15&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e591]:
              - generic [ref=e592]:
                - generic [ref=e593]:
                  - figure [ref=e594]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e596]
                  - generic [ref=e597]:
                    - generic [ref=e598]:
                      - heading " Nhân Viên Nhắc Hẹn Thanh Toán- Đi Làm Sau Lễ- Thu Nhập 15M No-Cv" [level=3] [ref=e600]:
                        - generic [ref=e603]: 
                        - text: Nhân Viên Nhắc Hẹn Thanh Toán- Đi Làm Sau Lễ- Thu Nhập 15M No-Cv
                      - generic [ref=e604]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e605]
                - generic [ref=e606]:
                  - generic [ref=e608]: 9 - 25 triệu
                  - generic [ref=e611]:
                    - generic [ref=e612]: 
                    - generic [ref=e613]: TP.HCM
              - generic [ref=e614]:
                - generic [ref=e615]:
                  - generic [ref=e617]: Phản hồi trong 48 giờ
                  - generic [ref=e618]: Không cần CV
                - generic [ref=e620]:
                  - generic [ref=e621]: 
                  - generic [ref=e622]: Còn 5 ngày
          - link " Nhân Viên Tư Vấn Chốt Đơn Khu Vực Quận Đống Đa No-Cv  Dl-DV-ĐT-Thinh-Vuong 15 - 18 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 6 ngày" [ref=e623] [cursor=pointer]:
            - /url: /ban-hang-kinh-doanh/nhan-vien-tu-van-chot-don-khu-vuc-quan-dong-da-no-cv-c13p122id200811889.html?open_from=0201_1_16&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e624]:
              - generic [ref=e625]:
                - generic [ref=e626]:
                  - figure [ref=e627]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e629]
                  - generic [ref=e630]:
                    - generic [ref=e631]:
                      - heading " Nhân Viên Tư Vấn Chốt Đơn Khu Vực Quận Đống Đa No-Cv" [level=3] [ref=e633]:
                        - generic [ref=e636]: 
                        - text: Nhân Viên Tư Vấn Chốt Đơn Khu Vực Quận Đống Đa No-Cv
                      - generic [ref=e637]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e638]
                - generic [ref=e639]:
                  - generic [ref=e641]: 15 - 18 triệu
                  - generic [ref=e644]:
                    - generic [ref=e645]: 
                    - generic [ref=e646]: TP.HCM
              - generic [ref=e647]:
                - generic [ref=e648]:
                  - generic [ref=e650]: Phản hồi trong 48 giờ
                  - generic [ref=e651]: Không cần CV
                - generic [ref=e653]:
                  - generic [ref=e654]: 
                  - generic [ref=e655]: Còn 6 ngày
          - link " Tư Vân Viên Sản Phẩm Dinh Dưỡng | Thu Nhập 10-18 Triệu | Không Yêu Cầu Kinh Nghiệm No-Cv  Dl-DV-ĐT-Thinh-Vuong 10 - 18 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 6 ngày" [ref=e656] [cursor=pointer]:
            - /url: /hanh-chinh-thu-ky/tu-van-vien-san-pham-dinh-duong-thu-nhap-10-18-trieu-khong-yeu-cau-kinh-nghiem-no-cv-c1p122id200811861.html?open_from=0201_1_17&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e657]:
              - generic [ref=e658]:
                - generic [ref=e659]:
                  - figure [ref=e660]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e662]
                  - generic [ref=e663]:
                    - generic [ref=e664]:
                      - heading " Tư Vân Viên Sản Phẩm Dinh Dưỡng | Thu Nhập 10-18 Triệu | Không Yêu Cầu Kinh Nghiệm No-Cv" [level=3] [ref=e666]:
                        - generic [ref=e669]: 
                        - text: Tư Vân Viên Sản Phẩm Dinh Dưỡng | Thu Nhập 10-18 Triệu | Không Yêu Cầu Kinh Nghiệm No-Cv
                      - generic [ref=e670]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e671]
                - generic [ref=e672]:
                  - generic [ref=e674]: 10 - 18 triệu
                  - generic [ref=e677]:
                    - generic [ref=e678]: 
                    - generic [ref=e679]: TP.HCM
              - generic [ref=e680]:
                - generic [ref=e681]:
                  - generic [ref=e683]: Phản hồi trong 48 giờ
                  - generic [ref=e684]: Không cần CV
                - generic [ref=e686]:
                  - generic [ref=e687]: 
                  - generic [ref=e688]: Còn 6 ngày
          - link " Nhân Viên An Ninh Và Bảo An No-Cv  Dl-DV-ĐT-Thinh-Vuong 11 - 18 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e689] [cursor=pointer]:
            - /url: /an-ninh-bao-ve/nhan-vien-an-ninh-va-bao-an-no-cv-c2p122id200811847.html?open_from=0201_1_18&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e690]:
              - generic [ref=e691]:
                - generic [ref=e692]:
                  - figure [ref=e693]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e695]
                  - generic [ref=e696]:
                    - generic [ref=e697]:
                      - heading " Nhân Viên An Ninh Và Bảo An No-Cv" [level=3] [ref=e699]:
                        - generic [ref=e702]: 
                        - text: Nhân Viên An Ninh Và Bảo An No-Cv
                      - generic [ref=e703]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e704]
                - generic [ref=e705]:
                  - generic [ref=e707]: 11 - 18 triệu
                  - generic [ref=e710]:
                    - generic [ref=e711]: 
                    - generic [ref=e712]: TP.HCM
              - generic [ref=e713]:
                - generic [ref=e714]:
                  - generic [ref=e716]: Phản hồi trong 48 giờ
                  - generic [ref=e717]: Không cần CV
                - generic [ref=e719]:
                  - generic [ref=e720]: 
                  - generic [ref=e721]: Còn 5 ngày
          - link " Nhân Viên Tư Vấn [Abbott] - Data Có Sẵn - Không Yêu Cầu Kinh Nghiệm No-Cv  Dl-DV-ĐT-Thinh-Vuong 10 - 18 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 5 ngày" [ref=e722] [cursor=pointer]:
            - /url: /ban-hang-kinh-doanh/nhan-vien-tu-van-abbott-data-co-san-khong-yeu-cau-kinh-nghiem-no-cv-c13p122id200811840.html?open_from=0201_1_19&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e723]:
              - generic [ref=e724]:
                - generic [ref=e725]:
                  - figure [ref=e726]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e728]
                  - generic [ref=e729]:
                    - generic [ref=e730]:
                      - heading " Nhân Viên Tư Vấn [Abbott] - Data Có Sẵn - Không Yêu Cầu Kinh Nghiệm No-Cv" [level=3] [ref=e732]:
                        - generic [ref=e735]: 
                        - text: Nhân Viên Tư Vấn [Abbott] - Data Có Sẵn - Không Yêu Cầu Kinh Nghiệm No-Cv
                      - generic [ref=e736]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e737]
                - generic [ref=e738]:
                  - generic [ref=e740]: 10 - 18 triệu
                  - generic [ref=e743]:
                    - generic [ref=e744]: 
                    - generic [ref=e745]: TP.HCM
              - generic [ref=e746]:
                - generic [ref=e747]:
                  - generic [ref=e749]: Phản hồi trong 48 giờ
                  - generic [ref=e750]: Không cần CV
                - generic [ref=e752]:
                  - generic [ref=e753]: 
                  - generic [ref=e754]: Còn 5 ngày
          - link " Nhân Viên Tư Vấn Bán Hàng Tại Bệnh Viện No-Cv  Dl-DV-ĐT-Thinh-Vuong 15 - 18 triệu  TP.HCM Phản hồi trong 48 giờ Không cần CV  Còn 3 ngày" [ref=e755] [cursor=pointer]:
            - /url: /ban-hang-kinh-doanh/nhan-vien-tu-van-ban-hang-tai-benh-vien-no-cv-c13p122id200811833.html?open_from=0201_1_20&search_id=8edb4022faab42252b2785bdf718e1d5
            - generic [ref=e756]:
              - generic [ref=e757]:
                - generic [ref=e758]:
                  - figure [ref=e759]:
                    - img "Dl-DV-ĐT-Thinh-Vuong" [ref=e761]
                  - generic [ref=e762]:
                    - generic [ref=e763]:
                      - heading " Nhân Viên Tư Vấn Bán Hàng Tại Bệnh Viện No-Cv" [level=3] [ref=e765]:
                        - generic [ref=e768]: 
                        - text: Nhân Viên Tư Vấn Bán Hàng Tại Bệnh Viện No-Cv
                      - generic [ref=e769]: 
                    - heading "Dl-DV-ĐT-Thinh-Vuong" [level=3] [ref=e770]
                - generic [ref=e771]:
                  - generic [ref=e773]: 15 - 18 triệu
                  - generic [ref=e776]:
                    - generic [ref=e777]: 
                    - generic [ref=e778]: TP.HCM
              - generic [ref=e779]:
                - generic [ref=e780]:
                  - generic [ref=e782]: Phản hồi trong 48 giờ
                  - generic [ref=e783]: Không cần CV
                - generic [ref=e785]:
                  - generic [ref=e786]: 
                  - generic [ref=e787]: Còn 3 ngày
        - generic [ref=e789]:
          - link "" [ref=e790] [cursor=pointer]:
            - /url: /tim-kiem-viec-lam-nhanh?is_cv_optional=1
            - generic [ref=e791]: 
          - link "1" [ref=e792] [cursor=pointer]:
            - /url: /tim-kiem-viec-lam-nhanh?is_cv_optional=1
          - link "2" [ref=e793] [cursor=pointer]:
            - /url: /tim-kiem-viec-lam-nhanh?is_cv_optional=1&page=2
          - link "3" [ref=e794] [cursor=pointer]:
            - /url: /tim-kiem-viec-lam-nhanh?is_cv_optional=1&page=3
          - link "4" [ref=e795] [cursor=pointer]:
            - /url: /tim-kiem-viec-lam-nhanh?is_cv_optional=1&page=4
          - link "5" [ref=e796] [cursor=pointer]:
            - /url: /tim-kiem-viec-lam-nhanh?is_cv_optional=1&page=5
          - link "" [ref=e797] [cursor=pointer]:
            - /url: /tim-kiem-viec-lam-nhanh?is_cv_optional=1&page=2
            - generic [ref=e798]: 
        - generic [ref=e799]:
          - generic [ref=e800]: Bạn thấy kết quả tìm kiếm có phù hợp không?
          - generic [ref=e801]:
            - button " Phù hợp" [ref=e802] [cursor=pointer]:
              - generic [ref=e803]: 
              - generic [ref=e804]: Phù hợp
            - button " Không hợp" [ref=e805] [cursor=pointer]:
              - generic [ref=e806]: 
              - generic [ref=e807]: Không hợp
        - generic [ref=e809]:
          - generic [ref=e810]:
            - img [ref=e811]
            - heading "Việc làm gợi ý" [level=2] [ref=e822]
          - generic [ref=e823]:
            - link "Nhân Viên Kinh Doanh - Thu Mua  Cty MTV QC Nanomax 7 - 12 triệu  TP.HCM  Còn 977 ngày" [ref=e824] [cursor=pointer]:
              - /url: /thuc-tap-sinh/nhan-vien-kinh-doanh-thu-mua-c53p122id200504024.html?open_from=0202_1_1
              - generic [ref=e825]:
                - generic [ref=e826]:
                  - generic [ref=e827]:
                    - figure [ref=e828]:
                      - img "Cty MTV QC Nanomax" [ref=e829]
                    - generic [ref=e830]:
                      - generic [ref=e831]:
                        - heading "Nhân Viên Kinh Doanh - Thu Mua" [level=3] [ref=e833]
                        - generic [ref=e834]: 
                      - heading "Cty MTV QC Nanomax" [level=3] [ref=e835]
                  - generic [ref=e836]:
                    - generic [ref=e838]: 7 - 12 triệu
                    - generic [ref=e841]:
                      - generic [ref=e842]: 
                      - generic [ref=e843]: TP.HCM
                - generic [ref=e847]:
                  - generic [ref=e848]: 
                  - generic [ref=e849]: Còn 977 ngày
            - link "Tuyển Dụng Nhân Viên Kế Toán - Làm Việc Tại Tp.HCM - 1774319961924  Cty TNHH Phương Nx 111 01 10 - 15 triệu  TP.HCM  Còn 5 ngày" [ref=e850] [cursor=pointer]:
              - /url: /ke-toan/tuyen-dung-nhan-vien-ke-toan-lam-viec-tai-tp-hcm-1774319961924-c17p122id200774144.html?open_from=0202_1_2
              - generic [ref=e851]:
                - generic [ref=e852]:
                  - generic [ref=e853]:
                    - figure [ref=e854]:
                      - img "Cty TNHH Phương Nx 111 01" [ref=e855]
                    - generic [ref=e856]:
                      - generic [ref=e857]:
                        - heading "Tuyển Dụng Nhân Viên Kế Toán - Làm Việc Tại Tp.HCM - 1774319961924" [level=3] [ref=e859]
                        - generic [ref=e860]: 
                      - heading "Cty TNHH Phương Nx 111 01" [level=3] [ref=e861]
                  - generic [ref=e862]:
                    - generic [ref=e864]: 10 - 15 triệu
                    - generic [ref=e867]:
                      - generic [ref=e868]: 
                      - generic [ref=e869]: TP.HCM
                - generic [ref=e873]:
                  - generic [ref=e874]: 
                  - generic [ref=e875]: Còn 5 ngày
            - link "Marketing Online 06042026  Cty MTV QC Nanomax 10 - 15 triệu  TP.HCM  Còn 8647 ngày" [ref=e876] [cursor=pointer]:
              - /url: /thuc-tap-sinh/marketing-online-06042026-c53p122id200777585.html?open_from=0202_1_3
              - generic [ref=e877]:
                - generic [ref=e878]:
                  - generic [ref=e879]:
                    - figure [ref=e880]:
                      - img "Cty MTV QC Nanomax" [ref=e881]
                    - generic [ref=e882]:
                      - generic [ref=e883]:
                        - heading "Marketing Online 06042026" [level=3] [ref=e885]
                        - generic [ref=e886]: 
                      - heading "Cty MTV QC Nanomax" [level=3] [ref=e887]
                  - generic [ref=e888]:
                    - generic [ref=e890]: 10 - 15 triệu
                    - generic [ref=e893]:
                      - generic [ref=e894]: 
                      - generic [ref=e895]: TP.HCM
                - generic [ref=e899]:
                  - generic [ref=e900]: 
                  - generic [ref=e901]: Còn 8647 ngày
            - link "Lái Xe  Cty MTV QC Nanomax 10 - 15 triệu  Hà Nội Không cần CV  Còn 3 ngày" [ref=e902] [cursor=pointer]:
              - /url: /thu-mua-kho-van-chuoi-cung-ung/lai-xe-c14p73id200793290.html?open_from=0202_1_4
              - generic [ref=e903]:
                - generic [ref=e904]:
                  - generic [ref=e905]:
                    - figure [ref=e906]:
                      - img "Cty MTV QC Nanomax" [ref=e907]
                    - generic [ref=e908]:
                      - generic [ref=e909]:
                        - heading "Lái Xe" [level=3] [ref=e911]
                        - generic [ref=e912]: 
                      - heading "Cty MTV QC Nanomax" [level=3] [ref=e913]
                  - generic [ref=e914]:
                    - generic [ref=e916]: 10 - 15 triệu
                    - generic [ref=e919]:
                      - generic [ref=e920]: 
                      - generic [ref=e921]: Hà Nội
                - generic [ref=e922]:
                  - generic [ref=e924]: Không cần CV
                  - generic [ref=e926]:
                    - generic [ref=e927]: 
                    - generic [ref=e928]: Còn 3 ngày
            - link "Nhân Viên Kinh Doanh (Lương Cơ Bản 72853700 Vnđ (Siêu Nhanh)  Huongrecruiterapi542112 8 - 10 triệu  Long An  Còn 24 ngày" [ref=e929] [cursor=pointer]:
              - /url: /van-hanh-bao-tri-bao-duong/nhan-vien-kinh-doanh-luong-co-ban-72853700-vnd-sieu-nhanh-c10p123id200440177.html?open_from=0202_1_5
              - generic [ref=e930]:
                - generic [ref=e931]:
                  - generic [ref=e932]:
                    - figure [ref=e933]:
                      - img "Huongrecruiterapi542112" [ref=e935]
                    - generic [ref=e936]:
                      - generic [ref=e937]:
                        - heading "Nhân Viên Kinh Doanh (Lương Cơ Bản 72853700 Vnđ (Siêu Nhanh)" [level=3] [ref=e939]
                        - generic [ref=e940]: 
                      - heading "Huongrecruiterapi542112" [level=3] [ref=e941]
                  - generic [ref=e942]:
                    - generic [ref=e944]: 8 - 10 triệu
                    - generic [ref=e947]:
                      - generic [ref=e948]: 
                      - generic [ref=e949]: Long An
                - generic [ref=e953]:
                  - generic [ref=e954]: 
                  - generic [ref=e955]: Còn 24 ngày
            - link "Tuyển Gấp Nhân Viên Bán Hàng 001  Cty TNHH Phương Nx 111 01 10 - 50 triệu  Hà Nội Không cần CV  Còn 8892 ngày" [ref=e956] [cursor=pointer]:
              - /url: /van-hanh-bao-tri-bao-duong/tuyen-gap-nhan-vien-ban-hang-001-c10p73id200531777.html?open_from=0202_1_6
              - generic [ref=e957]:
                - generic [ref=e958]:
                  - generic [ref=e959]:
                    - figure [ref=e960]:
                      - img "Cty TNHH Phương Nx 111 01" [ref=e961]
                    - generic [ref=e962]:
                      - generic [ref=e963]:
                        - heading "Tuyển Gấp Nhân Viên Bán Hàng 001" [level=3] [ref=e965]
                        - generic [ref=e966]: 
                      - heading "Cty TNHH Phương Nx 111 01" [level=3] [ref=e967]
                  - generic [ref=e968]:
                    - generic [ref=e970]: 10 - 50 triệu
                    - generic [ref=e973]:
                      - generic [ref=e974]: 
                      - generic [ref=e975]: Hà Nội
                - generic [ref=e976]:
                  - generic [ref=e978]: Không cần CV
                  - generic [ref=e980]:
                    - generic [ref=e981]: 
                    - generic [ref=e982]: Còn 8892 ngày
            - link "Re01 Tin Cần Cv  TNHH Tnhh1 10 - 15 triệu  An Giang, TP.HCM Không cần CV  Còn 12 ngày" [ref=e983] [cursor=pointer]:
              - /url: /an-ninh-bao-ve/re01-tin-can-cv-c2p129id200533107.html?open_from=0202_1_7
              - generic [ref=e984]:
                - generic [ref=e985]:
                  - generic [ref=e986]:
                    - figure [ref=e987]:
                      - img "TNHH Tnhh1" [ref=e988]
                    - generic [ref=e989]:
                      - generic [ref=e990]:
                        - heading "Re01 Tin Cần Cv" [level=3] [ref=e992]
                        - generic [ref=e993]: 
                      - heading "TNHH Tnhh1" [level=3] [ref=e994]
                  - generic [ref=e995]:
                    - generic [ref=e997]: 10 - 15 triệu
                    - generic [ref=e1000]:
                      - generic [ref=e1001]: 
                      - generic [ref=e1002]: An Giang, TP.HCM
                - generic [ref=e1003]:
                  - generic [ref=e1005]: Không cần CV
                  - generic [ref=e1007]:
                    - generic [ref=e1008]: 
                    - generic [ref=e1009]: Còn 12 ngày
      - generic [ref=e1012]:
        - heading "Việc làm theo nghề nghiệp" [level=2] [ref=e1013]:
          - img [ref=e1014]
          - generic [ref=e1031]: Việc làm theo nghề nghiệp
        - generic [ref=e1032]:
          - generic [ref=e1033]:
            - heading "Hành chính - Thư ký" [level=3] [ref=e1034]:
              - link "Hành chính - Thư ký" [ref=e1035] [cursor=pointer]:
                - /url: /viec-lam-hanh-chinh-thu-ky-o1.html
            - heading "An ninh - Bảo vệ" [level=3] [ref=e1036]:
              - link "An ninh - Bảo vệ" [ref=e1037] [cursor=pointer]:
                - /url: /viec-lam-an-ninh-bao-ve-o2.html
            - heading "Thiết kế - Sáng tạo nghệ thuật" [level=3] [ref=e1038]:
              - link "Thiết kế - Sáng tạo nghệ thuật" [ref=e1039] [cursor=pointer]:
                - /url: /viec-lam-thiet-ke-sang-tao-nghe-thuat-o3.html
            - heading "Kiến trúc - Thiết kế nội ngoại thất" [level=3] [ref=e1040]:
              - link "Kiến trúc - Thiết kế nội ngoại thất" [ref=e1041] [cursor=pointer]:
                - /url: /viec-lam-kien-truc-thiet-ke-noi-ngoai-that-o4.html
            - heading "Khách sạn - Nhà hàng - Du lịch" [level=3] [ref=e1042]:
              - link "Khách sạn - Nhà hàng - Du lịch" [ref=e1043] [cursor=pointer]:
                - /url: /viec-lam-khach-san-nha-hang-du-lich-o5.html
            - heading "Bán sỉ - Bán lẻ - Quản lý cửa hàng" [level=3] [ref=e1044]:
              - link "Bán sỉ - Bán lẻ - Quản lý cửa hàng" [ref=e1045] [cursor=pointer]:
                - /url: /viec-lam-ban-si-ban-le-quan-ly-cua-hang-o6.html
            - heading "IT Phần cứng - Mạng" [level=3] [ref=e1046]:
              - link "IT Phần cứng - Mạng" [ref=e1047] [cursor=pointer]:
                - /url: /viec-lam-it-phan-cung-mang-o7.html
            - heading "IT Phần mềm" [level=3] [ref=e1048]:
              - link "IT Phần mềm" [ref=e1049] [cursor=pointer]:
                - /url: /viec-lam-it-phan-mem-o8.html
          - generic [ref=e1050]:
            - heading "Sản xuất - Lắp ráp - Chế biến" [level=3] [ref=e1051]:
              - link "Sản xuất - Lắp ráp - Chế biến" [ref=e1052] [cursor=pointer]:
                - /url: /viec-lam-san-xuat-lap-rap-che-bien-o9.html
            - heading "Vận hành - Bảo trì - Bảo dưỡng" [level=3] [ref=e1053]:
              - link "Vận hành - Bảo trì - Bảo dưỡng" [ref=e1054] [cursor=pointer]:
                - /url: /viec-lam-van-hanh-bao-tri-bao-duong-o10.html
            - heading "Nông - Lâm - Ngư nghiệp" [level=3] [ref=e1055]:
              - link "Nông - Lâm - Ngư nghiệp" [ref=e1056] [cursor=pointer]:
                - /url: /viec-lam-nong-lam-ngu-nghiep-o11.html
            - heading "Marketing" [level=3] [ref=e1057]:
              - link "Marketing" [ref=e1058] [cursor=pointer]:
                - /url: /viec-lam-marketing-o12.html
            - heading "Bán hàng - Kinh doanh" [level=3] [ref=e1059]:
              - link "Bán hàng - Kinh doanh" [ref=e1060] [cursor=pointer]:
                - /url: /viec-lam-ban-hang-kinh-doanh-o13.html
            - heading "Thu mua - Kho Vận - Chuỗi cung ứng" [level=3] [ref=e1061]:
              - link "Thu mua - Kho Vận - Chuỗi cung ứng" [ref=e1062] [cursor=pointer]:
                - /url: /viec-lam-thu-mua-kho-van-chuoi-cung-ung-o14.html
            - heading "Xuất Nhập Khẩu" [level=3] [ref=e1063]:
              - link "Xuất Nhập Khẩu" [ref=e1064] [cursor=pointer]:
                - /url: /viec-lam-xuat-nhap-khau-o15.html
            - heading "Vận Tải - Lái xe - Giao nhận" [level=3] [ref=e1065]:
              - link "Vận Tải - Lái xe - Giao nhận" [ref=e1066] [cursor=pointer]:
                - /url: /viec-lam-van-tai-lai-xe-giao-nhan-o16.html
          - generic [ref=e1067]:
            - heading "Kế toán" [level=3] [ref=e1068]:
              - link "Kế toán" [ref=e1069] [cursor=pointer]:
                - /url: /viec-lam-ke-toan-o17.html
            - heading "Tài chính - Đầu tư - Chứng Khoán" [level=3] [ref=e1070]:
              - link "Tài chính - Đầu tư - Chứng Khoán" [ref=e1071] [cursor=pointer]:
                - /url: /viec-lam-tai-chinh-dau-tu-chung-khoan-o18.html
            - heading "Ngân hàng" [level=3] [ref=e1072]:
              - link "Ngân hàng" [ref=e1073] [cursor=pointer]:
                - /url: /viec-lam-ngan-hang-o19.html
            - heading "Khai thác năng lượng - Khoáng sản - Địa chất" [level=3] [ref=e1074]:
              - link "Khai thác năng lượng - Khoáng sản - Địa chất" [ref=e1075] [cursor=pointer]:
                - /url: /viec-lam-khai-thac-nang-luong-khoang-san-dia-chat-o20.html
            - heading "Y tế - Chăm sóc sức khỏe" [level=3] [ref=e1076]:
              - link "Y tế - Chăm sóc sức khỏe" [ref=e1077] [cursor=pointer]:
                - /url: /viec-lam-y-te-cham-soc-suc-khoe-o21.html
            - heading "Nhân sự" [level=3] [ref=e1078]:
              - link "Nhân sự" [ref=e1079] [cursor=pointer]:
                - /url: /viec-lam-nhan-su-o22.html
            - heading "Bảo hiểm" [level=3] [ref=e1080]:
              - link "Bảo hiểm" [ref=e1081] [cursor=pointer]:
                - /url: /viec-lam-bao-hiem-o23.html
            - heading "Thông tin - Truyền thông - Quảng cáo" [level=3] [ref=e1082]:
              - link "Thông tin - Truyền thông - Quảng cáo" [ref=e1083] [cursor=pointer]:
                - /url: /viec-lam-thong-tin-truyen-thong-quang-cao-o24.html
        - link "Xem tất cả nghề nghiệp " [ref=e1084] [cursor=pointer]:
          - /url: /viec-lam/viec-lam-theo-nganh-nghe
          - generic [ref=e1085]: Xem tất cả nghề nghiệp
          - generic [ref=e1086]: 
    - contentinfo [ref=e1087]:
      - generic [ref=e1088]:
        - img "mobile notification" [ref=e1090]
        - generic [ref=e1091]: Tìm việc làm nhanh
        - button "Tải ngay" [ref=e1092] [cursor=pointer]:
          - generic [ref=e1093]: Tải ngay
      - generic [ref=e1095]:
        - generic [ref=e1096]:
          - generic [ref=e1097]: Hotline cho Người tìm việc
          - generic [ref=e1098]:
            - generic [ref=e1099]:
              - generic [ref=e1100]:
                - img [ref=e1101]
                - paragraph [ref=e1103]: Hotline hỗ trợ miền Nam
              - generic [ref=e1104]: "HCM: (028) 7109 2424"
            - generic [ref=e1105]:
              - generic [ref=e1106]:
                - img [ref=e1107]
                - paragraph [ref=e1109]: Hotline hỗ trợ miền Bắc
              - generic [ref=e1110]: "HN: (024) 7309 2424"
          - button "Tư vấn cho Người tìm việc" [ref=e1113] [cursor=pointer]
        - generic [ref=e1115]:
          - generic [ref=e1116]: Hotline cho Nhà tuyển dụng
          - generic [ref=e1117]:
            - generic [ref=e1118]:
              - generic [ref=e1119]:
                - img [ref=e1120]
                - paragraph [ref=e1122]: Hotline hỗ trợ miền Nam
              - generic [ref=e1123]: "HCM: (028) 7108 2424"
            - generic [ref=e1124]:
              - generic [ref=e1125]:
                - img [ref=e1126]
                - paragraph [ref=e1128]: Hotline hỗ trợ miền Bắc
              - generic [ref=e1129]: "HN: (024) 7308 2424"
          - button "Tư vấn cho Nhà tuyển dụng" [ref=e1131] [cursor=pointer]
      - generic [ref=e1133]:
        - generic [ref=e1134]:
          - generic [ref=e1135]:
            - generic [ref=e1136]: Về chúng tôi
            - generic [ref=e1137]:
              - generic [ref=e1138]: Vieclam24h.vn - Công Ty Cổ Phần Việc Làm 24h
              - text: Tầng M, Tòa nhà Viet Dragon, số 141 Nguyễn Du, Phường Bến Thành, Thành phố Hồ Chí Minh
              - text: "Chi nhánh: Tầng 16, Tòa nhà TTC, Số 19 Phố Duy Tân, Phường Cầu Giấy, Hà Nội, Việt Nam"
              - text: "Giấy phép hoạt động dịch vụ việc làm số: 28937/2024/58/SLĐTBXH-VLATLĐ do Sở Lao Động Thương Binh và Xã Hội cấp ngày 18/11/2024"
              - text: "Điện thoại: (028) 7108 2424 | (024) 7308 2424"
              - text: "Email hỗ trợ người tìm việc: ntv@vieclam24h.vn"
              - text: "Email hỗ trợ nhà tuyển dụng: ntd@vieclam24h.vn"
          - generic [ref=e1140]:
            - generic [ref=e1141]:
              - generic [ref=e1142]: Thông tin
              - generic [ref=e1143]:
                - link "Cẩm nang nghề nghiệp" [ref=e1144] [cursor=pointer]:
                  - /url: https://seeker.vl24hv2.qc.sieuviet-team.com/nghe-nghiep?utm_source=vieclam24h.vn&utm_medium=referral&utm_campaign=site-vieclam24h.vn&utm_content=footer
                - link "Báo giá dịch vụ" [ref=e1145] [cursor=pointer]:
                  - /url: https://recruiter.vl24hv2.qc.sieuviet-team.com/thong-tin-dich-vu.html
                - link "Điều khoản sử dụng" [ref=e1146] [cursor=pointer]:
                  - /url: /dieu-khoan-su-dung.html
                - link "Quy định bảo mật" [ref=e1147] [cursor=pointer]:
                  - /url: /quy-dinh-bao-mat.html
                - link "Sơ đồ trang web" [ref=e1148] [cursor=pointer]:
                  - /url: /so-do-trang-web.html
                - link "Tuân thủ và sự đồng ý của Khách Hàng" [ref=e1149] [cursor=pointer]:
                  - /url: /tuan-thu-va-su-dong-y-cua-khach-hang.html
            - generic [ref=e1152]:
              - generic [ref=e1153]: Kết nối với chúng tôi
              - generic [ref=e1154]:
                - link [ref=e1155] [cursor=pointer]:
                  - /url: https://www.facebook.com/vieclam24h
                  - img [ref=e1156]
                - link [ref=e1159] [cursor=pointer]:
                  - /url: https://www.tiktok.com/@vieclam24h.vn
                  - img [ref=e1160]
                - link [ref=e1163] [cursor=pointer]:
                  - /url: https://zalo.me/1235743452982402805
                  - img [ref=e1164]
                - link [ref=e1167] [cursor=pointer]:
                  - /url: https://www.instagram.com/vieclam24h.vn_official/
                  - img [ref=e1168]
                - link [ref=e1171] [cursor=pointer]:
                  - /url: https://www.youtube.com/@vieclam24h-vn
                  - img [ref=e1172]
                - link [ref=e1175] [cursor=pointer]:
                  - /url: https://www.linkedin.com/company/vieclam24h/
                  - img [ref=e1176]
              - generic [ref=e1179]:
                - generic [ref=e1180]: Tải ứng dụng trên điện thoại
                - generic [ref=e1182]:
                  - button "VL24H CH Play" [ref=e1183] [cursor=pointer]:
                    - img "VL24H CH Play" [ref=e1184]
                  - button "VL24H Apple Store" [ref=e1185] [cursor=pointer]:
                    - img "VL24H Apple Store" [ref=e1186]
        - generic [ref=e1188]:
          - link [ref=e1189] [cursor=pointer]:
            - /url: https://nhanlucsieuviet.com/?utm_source=vieclam24h&utm_medium=logofooter&utm_campaign=homepage
            - img [ref=e1190]
          - generic [ref=e1210]: © 2026 - Bản quyền thuộc về SieuViet Group
    - link "img" [ref=e1212] [cursor=pointer]:
      - /url: https://www.messenger.com/t/389141851104907/
      - img "img" [ref=e1213]
  - alert [ref=e1214]
  - generic:
    - generic:
      - generic:
        - generic:
          - generic: 
          - textbox "Nhập vị trí muốn ứng tuyển"
        - button "Tìm"
      - generic:
        - generic:
          - generic:
            - button "":
              - generic: 
        - figure:
          - img "avt_invalid"
```

# Test source

```ts
  1   | const { UiActions, ScreenshotHelper } = require('../core/utils/commonUtils');
  2   | const { expect } = require('@playwright/test');
  3   | 
  4   | class BasePage {
  5   |   /**
  6   |    * @param {import('@playwright/test').Page} page
  7   |    */
  8   |   constructor(page, featureName) {
  9   |     this.page = page;
  10  |     this.actions = new UiActions(page);
  11  |     this.accountMenuButton = page.getByRole('button', { name: /avt_invalid|tài khoản|hồ sơ/i });
  12  |     this.appliedJobsButton = page.getByRole('button', { name: /Việc làm đã ứng tuyển/i });
  13  |     this.appliedJobsList = page.locator('[data-test-id="applied-job__list-jobs"]');
  14  |     const resolvedFeatureName = featureName || this.constructor.name.toLowerCase();
  15  |     this.screenshotHelper = new ScreenshotHelper(page, resolvedFeatureName);
  16  |   }
  17  | 
  18  |   async navigate(url, options = {}) {
  19  |     // Prefer 'load' to ensure full page resources, but allow overriding via options
  20  |     const gotoOptions = Object.assign({ waitUntil: 'load', timeout: 120000 }, options);
  21  |     try {
  22  |       await this.page.goto(url, gotoOptions);
  23  |     } catch (err) {
  24  |       // try to capture a screenshot for diagnosis, but don't fail the error handling if capture itself errors
  25  |       try {
  26  |         const safeName = String(url).replace(/[:\/\?&=.#]/g, '_');
  27  |         await this._capture('navigate_error', safeName);
  28  |       } catch (captureErr) {
  29  |         // ignore capture errors
  30  |       }
  31  | 
  32  |       // Retry once with a less strict waitUntil and longer timeout — helps when 'load' hangs on third-party resources
  33  |       try {
  34  |         await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  35  |       } catch (err2) {
  36  |         // Log and rethrow the original (or second) error so caller sees failure
  37  |         console.error(`Navigation to ${url} failed after retry:`, err2);
  38  |         throw err2;
  39  |       }
  40  |     }
  41  |   }
  42  | 
  43  |   /**
  44  |    * Chờ một element hiển thị ổn định trên trang.
  45  |    * @param {import('@playwright/test').Locator} locator - Locator của element cần chờ.
  46  |    */
  47  |   async waitForElement(locator) {
> 48  |     return locator.waitFor({ state: 'visible', timeout: 15000 });
      |                    ^ TimeoutError: locator.waitFor: Timeout 15000ms exceeded.
  49  |   }
  50  | 
  51  |   async _capture(actionName, details = '', fullPage = false, options = {}) {
  52  |     if (this.screenshotHelper) {
  53  |       const fileName = `${actionName}${details ? `-${details}` : ''}`;
  54  |       await this.screenshotHelper.takeScreenshot(fileName, fullPage, options);
  55  |     }
  56  |   }
  57  | 
  58  |   async capture(stepName, fullPage = false, options = {}) {
  59  |     // Chờ mạng cơ bản ổn định (không bắt buộc, catch lỗi timeout để không gián đoạn)
  60  |     await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
  61  | 
  62  |     // Chờ các Skeleton loaders (nếu có) biến mất khỏi DOM
  63  |     await this.page.waitForFunction(
  64  |       () => !document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"], [class*="loading-block"]'),
  65  |       null,
  66  |       { timeout: 15000 }
  67  |     ).catch(() => null);
  68  |     
  69  |     // Chờ giao diện (body) hết các hiệu ứng chuyển động/animation (ví dụ như Skeleton loader dùng animation)
  70  |     await this.waitForElementStable(this.page.locator('body'), { timeout: 5000 }).catch(() => null);
  71  | 
  72  |     return this._capture(stepName, '', fullPage, options);
  73  |   }
  74  | 
  75  |   async isElementInViewport(locator) {
  76  |     return locator.evaluate((element) => {
  77  |       const rect = element.getBoundingClientRect();
  78  |       const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  79  |       const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  80  | 
  81  |       return (
  82  |         rect.width > 0 &&
  83  |         rect.height > 0 &&
  84  |         rect.bottom > 0 &&
  85  |         rect.right > 0 &&
  86  |         rect.top < viewportHeight &&
  87  |         rect.left < viewportWidth
  88  |       );
  89  |     });
  90  |   }
  91  | 
  92  |   async scrollToElementIfOutsideViewport(locator) {
  93  |     const isInViewport = await this.isElementInViewport(locator);
  94  |     if (!isInViewport) {
  95  |       await locator.scrollIntoViewIfNeeded();
  96  |     }
  97  |   }
  98  | 
  99  |   async waitForElementStable(locatorOrSelector, options = {}) {
  100 |     const {
  101 |       timeout = 10000,
  102 |       stableFrameCount = 8,
  103 |       maxElements = 120,
  104 |     } = options;
  105 | 
  106 |     const locator = await this.actions.waitForVisible(locatorOrSelector, { timeout });
  107 | 
  108 |     await locator.evaluate(
  109 |       async (element, { timeout, stableFrameCount, maxElements }) => {
  110 |         const startedAt = performance.now();
  111 |         let previousSignature = '';
  112 |         let stableFrames = 0;
  113 | 
  114 |         const isVisible = (target) => {
  115 |           const rect = target.getBoundingClientRect();
  116 |           const style = window.getComputedStyle(target);
  117 |           return (
  118 |             style.visibility !== 'hidden' &&
  119 |             style.display !== 'none' &&
  120 |             Number(style.opacity) !== 0 &&
  121 |             rect.width > 1 &&
  122 |             rect.height > 1 &&
  123 |             rect.bottom >= 0 &&
  124 |             rect.right >= 0 &&
  125 |             rect.top <= window.innerHeight &&
  126 |             rect.left <= window.innerWidth
  127 |           );
  128 |         };
  129 | 
  130 |         const hasRunningAnimations = () => {
  131 |           if (typeof element.getAnimations !== 'function') return false;
  132 |           return element
  133 |             .getAnimations({ subtree: true })
  134 |             .some((animation) => animation.playState === 'running' || animation.pending);
  135 |         };
  136 | 
  137 |         const getSignature = () => {
  138 |           const targets = [element, ...Array.from(element.querySelectorAll('*')).slice(0, maxElements)];
  139 |           const parts = [];
  140 | 
  141 |           for (const target of targets) {
  142 |             if (!isVisible(target)) continue;
  143 | 
  144 |             const rect = target.getBoundingClientRect();
  145 |             const style = window.getComputedStyle(target);
  146 |             parts.push(
  147 |               Math.round(rect.left * 2) / 2,
  148 |               Math.round(rect.top * 2) / 2,
```
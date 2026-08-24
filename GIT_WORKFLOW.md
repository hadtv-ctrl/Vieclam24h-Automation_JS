# Git Workflow Guide - Dự Án Automation Testing

## 🚀 Quy Trình Commit & Push Hàng Ngày

### Bước 1: Kiểm tra trạng thái
```bash
git status
```

### Bước 2: Thêm file cần commit
```bash
# Thêm file cụ thể
git add tests/e2e/mytest.spec.js pages/MyPage.js

# Hoặc thêm tất cả thay đổi (kiểm tra git status trước)
git add .
```

### Bước 3: Commit với message có ý nghĩa
```bash
git commit -m "test(loginFlow): add email validation test"
```

**Format commit message:**
- `test(scope)`: Thêm/sửa test case
- `fix(scope)`: Fix bug
- `feat(scope)`: Tính năng mới
- `refactor(scope)`: Tái cấu trúc code
- `docs(scope)`: Cập nhật tài liệu

### Bước 4: Push lên remote
```bash
git push origin [tên-branch]

# Hoặc nếu branch đã setup upstream
git push
```

---

## 📋 Danh Sách Lệnh Hữu Ích

### Xem lịch sử commit
```bash
git log --oneline -10
```

### Xem thay đổi trước khi commit
```bash
git diff
```

### Xem thay đổi của file cụ thể
```bash
git diff tests/e2e/mytest.spec.js
```

### Unstage file (nếu thêm nhầm)
```bash
git reset HEAD tests/e2e/mytest.spec.js
```

### Undo commit cuối cùng (chưa push)
```bash
git reset --soft HEAD~1
```

### Xem branch hiện tại
```bash
git branch -v
```

### Tạo branch mới và chuyển sang
```bash
git checkout -b feature/my-feature
```

### Xem remote origin
```bash
git remote -v
```

---

## ⚡ Lệnh Nhanh (Quick Commands)

Thêm vào `package.json`:

```json
"scripts": {
  "test": "playwright test",
  "git:status": "git status",
  "git:push": "git add . && git commit -m \"test: update tests\" && git push"
}
```

Sau đó chỉ cần:
```bash
npm run git:push
```

---

## ✅ Checklist Trước Khi Push

- [ ] Chạy `npm run check:framework` (kiểm tra cấu trúc)
- [ ] Chạy test đã thay đổi: `npm run test -- tests/e2e/mytest.spec.js`
- [ ] Xem commit message rõ ràng
- [ ] Không commit file tự động sinh (test-results, playwright-report, evidence)
- [ ] Không commit .env hoặc credential

---

## 🔄 Cách Làm Việc Với Branch

### Pull request workflow:
```bash
# 1. Tạo branch feature
git checkout -b feature/new-test

# 2. Commit thay đổi
git add .
git commit -m "test(jobApply): add form validation test"

# 3. Push branch
git push origin feature/new-test

# 4. Tạo Pull Request trên GitHub

# 5. Merge & delete branch
git checkout main
git pull
git branch -d feature/new-test
git push origin --delete feature/new-test
```

---

## 🛠️ Setup Optional: Pre-commit Hook

Tạo file `.git/hooks/pre-commit`:

```bash
#!/bin/bash
echo "Running framework check before commit..."
npm run check:framework
if [ $? -ne 0 ]; then
  echo "❌ Framework check failed. Commit cancelled."
  exit 1
fi
echo "✅ Framework check passed. Proceeding with commit..."
```

Sau đó:
```bash
chmod +x .git/hooks/pre-commit
```

Nếu dùng Windows PowerShell, tạo `.git/hooks/pre-commit.ps1` hoặc dùng Husky (xem phần dưới).

---

## 📦 Setup Optional: Husky (Pre-commit Hook ngon lành)

```bash
# 1. Cài Husky
npm install husky --save-dev
npx husky install

# 2. Thêm hook
npx husky add .husky/pre-commit "npm run check:framework"
npx husky add .husky/pre-commit "npm run test:lint" (nếu có)

# 3. Commit
git add .
git commit -m "chore: setup husky pre-commit hooks"
```

---

## 🚫 Tránh Những Lỗi Phổ Biến

❌ **Không nên làm:**
```bash
# Commit toàn bộ mà không check
git add .
git commit -m "update"
git push

# Commit file tạm hoặc log
git add test-results/
git add debug.log
```

✅ **Nên làm:**
```bash
# Check trước
git status

# Commit cụ thể
git add pages/MyPage.js tests/e2e/mytest.spec.js
git commit -m "test(mytest): add new scenario"

# Review trước push
git log --oneline -1
git push
```

---

## 📞 Troubleshooting

### Lỗi: "branch not setup for tracking remote"
```bash
git push --set-upstream origin feature/my-feature
```

### Lỗi: "rejected because the tip of your current branch is behind"
```bash
git pull origin [branch-name]
git push
```

### Muốn xem diff chi tiết trước commit
```bash
git add .
git diff --cached
```


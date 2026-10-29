import json, sys, math
src = sys.argv[1]  # wordlists/exclusive/new dir
out = sys.argv[2]
POS = {'n':'Danh từ','v':'Động từ','a':'Tính từ','d':'Phó từ','m':'Số từ','q':'Lượng từ','r':'Đại từ','p':'Giới từ','c':'Liên từ','u':'Trợ từ','e':'Thán từ','y':'Trợ từ ngữ khí','o':'Từ tượng thanh','t':'Danh từ thời gian','f':'Phương vị từ','s':'Danh từ nơi chốn','nr':'Tên riêng','ns':'Địa danh','vn':'Động danh từ','ad':'Phó tính từ','an':'Danh tính từ','b':'Từ khu biệt','i':'Thành ngữ','l':'Cụm từ','z':'Từ trạng thái','vd':'Phó động từ','j':'Viết tắt','nz':'Danh từ riêng','k':'Hậu tố','h':'Tiền tố','g':'Ngữ tố','x':'Khác'}
allw = []
for lvl in (1, 2):
    d = json.load(open(f"{src}/{lvl}.json"))
    for i, w in enumerate(d, 1):
        f = w['forms'][0]
        allw.append({'id': f"h{lvl}-{i:04d}", 'level': lvl, 'w': w['simplified'],
                     'py': f['transcriptions']['pinyin'], 'pos': w.get('pos', []),
                     'en': '; '.join(f['meanings'][:3])[:160]})
json.dump(allw, open(f"{out}/base.json", 'w'), ensure_ascii=False)
n = 10; size = math.ceil(len(allw) / n)
for b in range(n):
    chunk = allw[b*size:(b+1)*size]
    with open(f"{out}/in/batch{b:02d}.tsv", 'w') as fh:
        fh.write("id\tword\tpinyin\tpos\tenglish\n")
        for w in chunk:
            fh.write(f"{w['id']}\t{w['w']}\t{w['py']}\t{','.join(w['pos'])}\t{w['en']}\n")
    print(b, len(chunk), chunk[0]['id'], chunk[-1]['id'])
print(len(allw))

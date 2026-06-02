document.addEventListener("DOMContentLoaded", function () {
    // 公共弹窗
    class YGPopupBox extends HTMLElement {
        constructor() {
            super();
            this.clickClosePopup = this.clickClosePopup.bind(this);
            this.clickOpenPopup = this.clickOpenPopup.bind(this);
            this.$contentInner = null;
        }

        connectedCallback() {
            this.$contentInner = this.querySelector('.yg-popup-box-content-inner');
            this.addEventListener('click', this.clickClosePopup)
            document.addEventListener("YGPopup:open", this.clickOpenPopup)
        }

        disconnectedCallback() {
            this.removeEventListener('click', this.handleClick);
            document.removeEventListener('YGPopupBox:open', this.handleOpenEvent);
        }

        clickOpenPopup(event) {
            const { $popupTemplate, fn } = event.detail;
            this.openPopup($popupTemplate, fn);
        }

        clickClosePopup(e) {
            this.closePopup(e, () => { });
        }

        openPopup($popupTemplate, fn) {
            // popupTemplate：需要替换的元素
            if (!$popupTemplate || !this.$contentInner) return;
            this.$contentInner.innerHTML = $popupTemplate.innerHTML;
            document.body.style.overflow = 'hidden';
            this.style.display = 'flex';
            typeof fn === 'function' && fn();
        }

        closePopup(e, fn) {
            let closeClassName = ["yg-popup-box-close", "yg-popup-box"]
            if (closeClassName.some(className => e.target.classList.contains(className))) {
                this.style.display = 'none';
                this.$contentInner.innerHTML = '';
                document.body.style.overflow = 'auto';
                typeof fn === 'function' && fn();
            }
        }
    }
    if (!window.customElements.get('yg-popup-box')) {
        window.customElements.define('yg-popup-box', YGPopupBox);
    }
    // 公共打开弹窗逻辑
    class YGOpenPopup extends HTMLElement {
        constructor() {
            super();
            // 执行函数并指向自身
            this.itemClick = this.itemClick.bind(this);
        }
        // 当元素插入 DOM 时，添加点击事件监听器
        connectedCallback() {
            this.addEventListener('click', this.itemClick);
        }
        // 当元素从 DOM 移除时，清理事件监听器，防止内存泄漏
        disconnectedCallback() {
            this.removeEventListener('click', this.itemClick);
        }
        // 当元素被点击时，尝试查找 <template> 或类名为 yg-popup-template 的子元素作为弹窗模板
        itemClick() {
            let $popupTemplate = this.querySelector('template') || this.querySelector('.yg-popup-template');

            if ($popupTemplate) {
                document.dispatchEvent(new CustomEvent("YGPopup:open", {
                    bubbles: true,
                    detail: {
                        $popupTemplate,
                        fn: () => { }
                    }
                }))
            }
        }
    }
    if (!window.customElements.get('yg-open-popup')) {
        window.customElements.define('yg-open-popup', YGOpenPopup);
    }

  //   动态源视频
  const templates = document.querySelectorAll('template.yg-video-main');

  templates.forEach(template => {
    const templateContent = template.content;
    const iframes = templateContent.querySelectorAll('iframe.yg-dynamic-video');

    iframes.forEach(iframe => {
      const dynamicUrl = iframe.dataset.dynamicUrl;

      if (dynamicUrl) {
        let videoId = null;

        // 尝试从 youtu.be 链接中提取 ID
        if (dynamicUrl.includes('youtu.be/')) {
          const parts = dynamicUrl.split('youtu.be/');
          if (parts.length > 1) {
            videoId = parts[1].split('?')[0]; // 获取 ? 前面的部分
          }
        }
        // 如果没有找到 youtu.be 链接，尝试从 youtube.com 链接中提取 ID
        else if (dynamicUrl.includes('youtube.com/watch?v=')) {
          const urlParams = new URLSearchParams(dynamicUrl.split('?')[1]);
          videoId = urlParams.get('v');
        }

        if (videoId) {
          let src = iframe.src;
          src = src.replace(/embed\/(.*?)\?/, `embed/${videoId}?`);
          src = src.replace(/playlist=([^&]*)/, `playlist=${videoId}`);
          iframe.src = src;
        }
      }
    });
  });

})
// 以下是自定义组件

document.addEventListener("DOMContentLoaded", function () {
    class YGaddtocart extends HTMLElement{
        constructor(){
            super()
        }
        connectedCallback(){
            this.addEventListener("click",this.addtocart)
        }
        addtocart(){
           const $addtocart =  this.parentElement.querySelector(".quick-add") || this.nextElementSibling
           if($addtocart || $addtocart.classList.contains(".quick-add")){
                $addtocart.querySelector("button").click()
           }
        }
    }
    if (!window.customElements.get('yg-add-to-cart')) {
        window.customElements.define('yg-add-to-cart', YGaddtocart);
    }

    class YGProductHover extends HTMLElement{
        constructor(){
            super()
        }
        connectedCallback(){
            this.HoverColor()
        }
        HoverColor(){
            const $data = this.querySelectorAll(".product-card__content .yg-color-and-rating .swatches a")
            const $img = this.querySelector(".media img")
            const $addcar = this.querySelector(".yg-price-and-quikadd .yg-add-card")
            $data.forEach(el=>{
                el.addEventListener("click",function(event){
                    event.preventDefault()
                    $data.forEach(item=>{
                        item.parentElement.classList.remove("active")
                    })
                    el.parentElement.classList.add("active") 
                    $img.setAttribute("src",el.dataset.src)
                    $img.setAttribute("srcset",el.dataset.src)
                    $addcar.setAttribute("href",el.getAttribute("href"))
                })
            })
        }
    }
    if (!window.customElements.get('yg-product-hover')) {
        window.customElements.define('yg-product-hover', YGProductHover);
    }

    class YGInfo extends HTMLElement {
      constructor() {
        super();
        // 目前是默认展开的考虑，如果默认收起，需要修改代码
        this.contentHeight = null;
      }

      connectedCallback() {
        const $content = this.querySelector('[is="content-box"]');

        if($content.hasAttribute("yg-wait")) {

          const observer = new MutationObserver((mutationsList, observer) => {
            for (let mutation of mutationsList) {
              if (mutation.type === 'attributes' && !mutation.target.hasAttribute('yg-wait')) {
                // this.initializeContent();

                this.addEventListener('click', this.itemClick.bind(this));
                this.contentHeight = $content.offsetHeight;
                $content.style.height = this.contentHeight + 'px';

                observer.disconnect();
              }
            }
          });
  
          observer.observe($content, { attributes: true });

        } else {
          this.addEventListener('click', this.itemClick.bind(this));
          this.contentHeight = $content.offsetHeight;
          $content.style.height = this.contentHeight + 'px';
        }
      }
      disconnectedCallback() {
        this.removeEventListener('click', this.itemClick.bind(this));
      }

      itemClick(event) {
        const $title = this.querySelector('[is="title-box"]');
        const $content = this.querySelector('[is="content-box"]');
    
        // 确保点击事件只在标题上触发
        if (event.target.closest('[is="title-box"]')) {
          if (!$title.classList.contains('yg-hide')) {
            // 隐藏
            $title.classList.add('yg-hide');
            $content.style.height = 0;
          } else {
            // 展示
            $title.classList.remove('yg-hide');
            $content.style.height = this.contentHeight + 'px';
          }
        }
      }

    }
    if (!window.customElements.get('yg-info')) {
        window.customElements.define('yg-info', YGInfo);
    }

    class YGAnchorTab extends HTMLElement {
      constructor() {
        super()
        this.scrollTimer = null
        this.init()
      }
      init() {
        let $sectionBox = this.closest('.yg-anchor-section');
        this.calculateTopValue($sectionBox);
      }
  
      intersectionObserver($ygProductTabList) {
        const options = {
          rootMargin: '-30%',
          threshold: [0.1],
        }
  
        const intersectionObserver = new IntersectionObserver((entries) => {
          // 判断进入页面范围
          if (entries[0].intersectionRatio > 0.1) {
            $ygProductTabList.forEach((productTab) => {
              if (
                entries[0].target.getAttribute(
                  'data-section-number'
                ) == productTab.getAttribute('data-section-number')
              ) {
                this.removeClassName($ygProductTabList)
                // 给当前项添加激活类
                productTab.classList.add('active')
              }
            })
          }
        }, options)
  
        return intersectionObserver
      }
  
      toggleClassName(sectionTop ,sectionBox, className) {
        clearTimeout(this.scrollTimer)
  
        // 设置新的定时器
        this.scrollTimer = setTimeout(function () {
          // 在页面滚动停止后执行的操作
          if (sectionTop < window.scrollY) {
            sectionBox.classList.add(className)
          } else {
            sectionBox.classList.remove(className)
          }
        }, 150) // 这里的 150 是延迟时间，单位为毫秒
      }
  
      removeClassName($domList) {
        $domList.forEach($dom => {
          $dom.classList.remove('active');
        });
      }
  
      calculateTopValue(sectionBox) {
        let sectionTop = sectionBox.nextElementSibling.getBoundingClientRect().top + window.scrollY
  
        let $ygSectionList = document.querySelectorAll('body main .shopify-section');
        let $ygProductTabList = this.querySelectorAll('span');

        let intersectionObserver = this.intersectionObserver($ygProductTabList)
  
        // 开始观察
        $ygSectionList.forEach(function (Section, i) {
          // 给每个Section添加data-section-number属性
          Section.setAttribute('data-section-number', i)
          intersectionObserver.observe(Section)
        })
        
        const _this = this;

        $ygProductTabList.forEach(function (e) {
          e.onclick = function () {
            // 获取点击项的data-section-number属性值
            let number = e.getAttribute('data-section-number')
            // 移除所有激活类

            _this.removeClassName($ygProductTabList)

            // 给当前点击项添加激活类
            e.classList.add('active')
            if (number) {
              // 遍历ygSectionList，停止观察
              $ygSectionList.forEach(function (Section) {
                intersectionObserver.unobserve(Section)
              })
  
              // 通过属性值获取dom节点
              let pointDom = $ygSectionList[number]
              // 计算滚动距离
              let pointTop =
                pointDom.offsetTop -
                sectionBox.getBoundingClientRect().height -
                80 // 80为导航栏高度
              // 滑动到指定dom节点
              window.scrollTo({
                top: pointTop,
                behavior: 'smooth',
              })
  
              // 遍历ygSectionList，延时500ms后重新开始观察
              setTimeout(function () {
                $ygSectionList.forEach(function (Section) {
                  intersectionObserver.observe(Section)
                })
              }, 500)
            }
          }
        })
  
        // 添加滚动事件监听器
        window.addEventListener('scroll', () => this.toggleClassName(sectionTop, sectionBox, "active"))
      }
    }
    if (!window.customElements.get('yg-anchor-tab')) {
      window.customElements.define('yg-anchor-tab', YGAnchorTab)
    }

    class YGIconList extends HTMLElement {
        constructor() {
            super()
        }
        connectedCallback() {
          // document.addEventListener('YG:variantChange', function(e){
          //   console.log("variant", e.detail);
          // });
        }
        changeVariant(name, value) {
          console.log(name, value)

        }
    }
    if (!window.customElements.get('.yg-icon-list')) {
        window.customElements.define('yg-icon-list', YGIconList)
    }
})
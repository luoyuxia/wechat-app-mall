const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')
const TOOLS = require('../../utils/tools.js') // TOOLS.showTabBarBadge();
const QQMapWX = require('../../utils/qqmap-wx-jssdk.min.js');
var qqmapsdk;

Page({
  /**
   * 页面的初始数据
   */
  data: {
    categories: [],
    activeCategory: 0,
    categorySelected: {
      name: '',
      id: ''
    },
    currentGoods: [],
    onLoadStatus: true,
    scrolltop: 0,

    skuCurGoods: undefined,
    page: 1,
    pageSize: 20,
    buyType: 0,
    distance: 0
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    wx.showShareMenu({
      withShareTicket: true
    })
    this.setData({
      categoryMod: wx.getStorageSync('categoryMod')
    })
    this.categories();
    this.getDistance();
  },
  buyTypeChange(e) {
    this.setData({
      buyType: e.detail.value
    })
    console.log(this.data.buyType)
  },

  onShopInfo(e) {
    console.log(e)
    wx.navigateTo({
      url: '/pages/store-address/store-address'
    })
  },

  async getDistance() {
    qqmapsdk = new QQMapWX({
      key: 'ZM3BZ-ZDU6D-HSG4T-PIYBP-VUQF3-6OFG3'
    });
    const currentPos = {
      latitude: 30.25961, longitude: 120.13026
    };
    var _that = this
    qqmapsdk.calculateDistance({
      to: [currentPos],
      success: function(res) {
        let hw = res.result.elements[0].distance //拿到距离(米)
        console.log(hw)
        if (hw>=0) { //拿到正确的值
          //转换成公里
          hw = (hw / 2 / 500).toFixed(2) + '公里'
          _that.setData({
            distance: hw
          })
      } else {
          hw = "距离太近或请刷新重试"
      }
      console.log('腾讯地图计算距离商家' + hw);
      }
    })
  },


  async categories() {
    wx.showLoading({
      title: '',
    })
    const res = await WXAPI.goodsCategory()
    wx.hideLoading()
    let activeCategory = 0
    let categorySelected = this.data.categorySelected
    if (res.code == 0) {
      const categories = res.data.filter(ele => {
        return !ele.vopCid1 && !ele.vopCid2
      })
      categories.forEach(p => {
        p.childs = categories.filter(ele => {
          return p.id == ele.pid
        })
      })
      const firstCategories = categories.filter(ele => { return ele.level == 1 })
      if (this.data.categorySelected.id) {
        activeCategory = firstCategories.findIndex(ele => {
          return ele.id == this.data.categorySelected.id
        })
        categorySelected = firstCategories[activeCategory]
      } else {
        categorySelected = firstCategories[0]
      }
      const resAd = await WXAPI.adPosition('category_' + categorySelected.id)
      let adPosition = null
      if (resAd.code === 0) {
        adPosition = resAd.data
      }
      this.setData({
        page: 1,
        activeCategory,
        categories,
        firstCategories,
        categorySelected,
        adPosition
      })
      this.getGoodsList()
    }
  },
  async getGoodsList() {
    if (this.data.categoryMod == 2) {
      return
    }
    wx.showLoading({
      title: '',
    })
    // secondCategoryId
    let categoryId = ''
    if (this.data.secondCategoryId) {
      categoryId = this.data.secondCategoryId
    } else if(this.data.categorySelected.id) {
      categoryId = this.data.categorySelected.id
    }
    // https://www.yuque.com/apifm/nu0f75/wg5t98
    const res = await WXAPI.goodsv2({
      categoryId,
      page: this.data.page,
      pageSize: this.data.pageSize
    })
    wx.hideLoading()
    if (res.code == 700) {
      if (this.data.page == 1) {
        this.setData({
          currentGoods: null
        });
      } else {
        wx.showToast({
          title: '没有更多了',
          icon: 'none'
        })
      }
      return
    }
    if (res.code != 0) {
      wx.showToast({
        title: res.msg,
        icon: 'none'
      })
      return
    }
    if (this.data.page == 1) {
      this.setData({
        currentGoods: res.data.result
      })
    } else {
      this.setData({
        currentGoods: this.data.currentGoods.concat(res.data.result)
      })
    }
  },
  async onCategoryClick(e) {
    console.log("onCategoryClick")
    const idx = e.target.dataset.idx
    console.log("categories size" + this.data.categories.length)
    console.log("activeCategory " + this.data.activeCategory)
    console.log("onCategoryClick " + idx)
    this.jumpToCategory(idx)
  },

  async jumpToCategory(idx) {
    if(idx >= this.data.categories.length) {
      return
    }
    if (idx == this.data.activeCategory) {
      this.setData({
        scrolltop: 0,
      })
      return
    }
    const categorySelected = this.data.firstCategories[idx]
    const res = await WXAPI.adPosition('category_' + categorySelected.id)
    let adPosition = null
    if (res.code === 0) {
      adPosition = res.data
    }
    this.setData({
      page: 1,
      secondCategoryId: '',
      activeCategory: idx,
      categorySelected,
      scrolltop: 0,
      adPosition
    });
    this.getGoodsList();
  },
  
  onSecondCategoryClick(e) {
    console.log("onCategoryClick")
    const idx = e.detail.index
    let secondCategoryId = ''
    if (idx) {
      // 点击了具体的分类
      secondCategoryId = this.data.categorySelected.childs[idx-1].id
    }
    this.setData({
      page: 1,
      secondCategoryId
    });
    this.getGoodsList();
  },
  bindconfirm(e) {
    this.setData({
      inputVal: e.detail
    })
    wx.navigateTo({
      url: '/pages/goods/list?name=' + this.data.inputVal,
    })
  },
  onShareAppMessage() {    
    return {
      title: '"' + wx.getStorageSync('mallName') + '" ' + wx.getStorageSync('share_profile'),
      path: '/pages/index/index?inviter_id=' + wx.getStorageSync('uid')
    }
  },
  onShow() {
    console.log("on show: " )
    AUTH.checkHasLogined().then(isLogined => {
      if (isLogined) {
        this.setData({
          wxlogin: isLogined
        })
        TOOLS.showTabBarBadge() // 获取购物车数据，显示TabBarBadge
      }
    })
    const _categoryId = wx.getStorageSync('_categoryId')
    wx.removeStorageSync('_categoryId')
    if (_categoryId) {
      this.data.categorySelected.id = _categoryId
      this.categories();
    }
    const _buyType = wx.getStorageSync('_buyType')
    console.log("buy type: " + _buyType)
    if(_buyType) {
      this.setData({
        buyType: _buyType
      });
    }
  },
  async addShopCar(e) {
    const curGood = this.data.currentGoods.find(ele => {
      return ele.id == e.currentTarget.dataset.id
    })
    if (!curGood) {
      return
    }
    if (curGood.stores <= 0) {
      wx.showToast({
        title: '已售罄~',
        icon: 'none'
      })
      return
    }
    if (!curGood.propertyIds && !curGood.hasAddition) {
      // 直接调用加入购物车方法
      const res = await WXAPI.shippingCarInfoAddItem(wx.getStorageSync('token'), curGood.id, 1, [])
      if (res.code == 30002) {
        // 需要选择规格尺寸
        this.setData({
          skuCurGoods: curGood
        })
      } else if (res.code == 0) {
        wx.showToast({
          title: '加入成功',
          icon: 'success'
        })
        wx.showTabBar()
        TOOLS.showTabBarBadge() // 获取购物车数据，显示TabBarBadge
      } else {
        wx.showToast({
          title: res.msg,
          icon: 'none'
        })
      }
    } else {
      // 需要选择 SKU 和 可选配件
      this.setData({
        skuCurGoods: curGood
      })
    }
  },
  goodsGoBottom() {
    this.data.page++
    this.getGoodsList()
  },
  adPositionClick(e) {
    const url = e.target.dataset.url
    if (url) {
      wx.navigateTo({
        url: url
      })
    }
  },
  searchscan() {
    wx.scanCode({
      scanType: ['barCode', 'qrCode', 'datamatrix', 'pdf417'],
      success: res => {
        this.setData({
          inputVal: res.result
        })
        wx.navigateTo({
          url: '/pages/goods/list?name=' + res.result,
        })
      }
    })
  }
})
// Description: This model provides an interface for navigating an EPUB's package document
Epub.PackageDocument = Backbone.Model.extend({

    initialize : function (attributes, options) {

        var packageDocument = this.get("packageDocumentObject");
        this.manifest = new Epub.Manifest(packageDocument.manifest);
        this.spine = new Epub.Spine(packageDocument.spine);
        this.metadata = new Epub.Metadata(packageDocument.metadata);
        this.bindings = new Epub.Spine(packageDocument.bindings);
        this.pageSpreadProperty = new Epub.PageSpreadProperty();

        // If this book is fixed layout, assign the page spread class
        if (this.isFixedLayout()) {
            this.assignPageSpreadClass();
        }
    },

    getSpineInfo : function () {

        var that = this;
        var spineInfo = [];
        this.spine.each(function (spineItem) {

            spineInfo.push(that.generateSpineInfo(spineItem));
        });

        return {
            spine : spineInfo, 
            bindings : this.bindings.toJSON()
        };
    },

    isFixedLayout : function () {

        if (this.metadata.get("fixed_layout")) {
            return true; 
        }
        else {
            return false;
        }
    },

    getManifestItemById : function (id) {

        var foundManifestItem = this.manifest.find(
            function (manifestItem) { 
                if (manifestItem.get("id") === id) {
                    return manifestItem;
                }
            });

        if (foundManifestItem) {
            return foundManifestItem.toJSON();
        }
        else {
            return undefined;
        }
    },

    getManifestItemByIdref : function (idref) {

        var foundManifestItem = this.getManifestItemById(idref);
        if (foundManifestItem) {
            return foundManifestItem;
        }
        else {
            return undefined;
        }
    },

    getSpineItemByIdref : function (idref) {

        var foundSpineItem = this.getSpineModelByIdref(idref);
        if (foundSpineItem) {
            return foundSpineItem.toJSON();
        }
        else {
            return undefined;
        }
    },

    getSpineItem : function (spineIndex) {

        var spineItem = this.spine.at(spineIndex);
        if (spineItem) {
            return spineItem.toJSON();
        }
        else {
            return undefined;
        }
    },

    spineLength : function () {
        return this.spine.length;
    },

    // Description: gets the next position in the spine for which the
    // spineItem does not have `linear='no'`. The start
    // param is the non-inclusive position to begin the search
    // from. If start is not supplied, the search will begin at
    // postion 0. If no linear position can be found, this 
    // function returns undefined
    getNextLinearSpinePosition : function (currSpineIndex) {

        var spine = this.spine;
        if (currSpineIndex === undefined || currSpineIndex < 0) {
            currSpineIndex = 0;

            if (spine.at(currSpineIndex).get("linear") !== "no") {
                return currSpineIndex;
            }
        }

        while (currSpineIndex < this.spineLength() - 1) {
            currSpineIndex += 1;
            if (spine.at(currSpineIndex).get("linear") !== "no") {
                return currSpineIndex;
            }
        }

        // No next linear spine position.
        return undefined; 
    },

    // Description: gets the previous position in the spine for which the
    // spineItem does not have `linear='no'`. The start
    // param is the non-inclusive position to begin the search
    // from. If start is not supplied, the search will begin at
    // the end of the spine. If no linear position can be found, 
    // this function returns undefined
    getPrevLinearSpinePosition : function(currSpineIndex) {

        var spine = this.spine;
        if (currSpineIndex === undefined || currSpineIndex > this.spineLength() - 1) {
            currSpineIndex = this.spineLength() - 1;

            if (spine.at(currSpineIndex).get("linear") !== "no") {
                return currSpineIndex;
            }
        }

        while (currSpineIndex > 0) {
            currSpineIndex -= 1;
            if (spine.at(currSpineIndex).get("linear") !== "no") {
                return currSpineIndex;
            }
        }

        // No previous linear spine position.
        return undefined;
    },

    hasNextSection: function(currSpineIndex) {

        if (currSpineIndex >= 0 &&
            currSpineIndex <= this.spineLength() - 1) {
            
            return this.getNextLinearSpinePosition(currSpineIndex) > -1;
        }
        else {
            return false;
        }
    },

    hasPrevSection: function(currSpineIndex) {

        if (currSpineIndex >= 0 &&
            currSpineIndex <= this.spineLength() - 1) {

            return this.getPrevLinearSpinePosition(currSpineIndex) > -1;    
        }
        else {
            return false;
        }
    },

    pageProgressionDirection : function () {

        if (this.metadata.get("page_prog_dir") === "rtl") {
            return "rtl";
        }
        else if (this.metadata.get("page_prog_dir") === "default") {
            return "default";
        }
        else {
            return "ltr";
        }
    },

    getSpineIndexByHref : function (manifestHref) {

        var spineItem = this.getSpineModelFromHref(manifestHref);
        return this.getSpineIndex(spineItem);
    },

    getBindingByHandler : function (handler) {

        var binding = this.bindings.find(
            function (binding) {

                if (binding.get("handler") === handler) {
                    return binding;
                }
            });

        if (binding) {
            return binding.toJSON();
        }
        else {
            return undefined;
        }
    },

    generateSpineInfo : function (spineItem) {

        var isFixedLayout = false;
        var fixedLayoutType = undefined;
        var manifestItem = this.getManifestModelByIdref(spineItem.get("idref"));

        // Get fixed layout properties
        if (spineItem.isFixedLayout() || this.isFixedLayout()) {
            isFixedLayout = true;
            
            if (manifestItem.isSvg()) {
                fixedLayoutType = "svg";
            }
            else if (manifestItem.isImage()) {
                fixedLayoutType = "image";
            }
            else {
                fixedLayoutType = "xhtml";
            }
        }

        return {
            contentDocumentURI : this.getManifestItemByIdref(spineItem.get("idref")).contentDocumentURI,
            title : this.metadata.get("title"),
            firstPageIsOffset : false, // This needs to be determined
            pageProgressionDirection : this.pageProgressionDirection(),
            spineIndex : this.getSpineIndex(spineItem),
            pageSpread : spineItem.get("page_spread"),
            isFixedLayout : isFixedLayout, 
            fixedLayoutType : fixedLayoutType,
            mediaType : manifestItem.get("media_type")
        };
    },

    getPackageDocumentDOM : function () {

        var parser = new window.DOMParser;
        var packageDocumentDom = parser.parseFromString(this.get("packageDocument"), "text/xml");
        return packageDocumentDom;
    },

    getToc : function () {

        var item = this.getTocItem();
        if (item) {
            var href = item.get("contentDocumentURI");
            return href;
        }
        return null;
    },


    // ----------------------- PRIVATE HELPERS -------------------------------- //

    // Refactoring candidate: This search will always iterate through entire manifest; this should be modified to 
    //   return when the manifest item is found.
    getSpineModelFromHref : function (manifestHref) {

        var that = this;
        var resourceURI = new URI(manifestHref);
        var resourceName = resourceURI.filename();
        var foundSpineModel; 

        this.manifest.each(function (manifestItem) {

            var manifestItemURI = new URI(manifestItem.get("href"));
            var manifestItemName = manifestItemURI.filename();

            // Rationale: Return a spine model based on the manifest item id, which is the idref of the spine item
            if (manifestItemName === resourceName) {
                foundSpineModel = that.getSpineModelByIdref(manifestItem.get("id"));
            }
        });

        return foundSpineModel;
    },

    getSpineModelByIdref : function (idref) {

        var foundSpineItem = this.spine.find(
            function (spineItem) { 
                if (spineItem.get("idref") === idref) {
                    return spineItem;
                }
            });

        return foundSpineItem;
    },

    getManifestModelByIdref : function (idref) {

        var foundManifestItem = this.manifest.find(
            function (manifestItem) { 
                if (manifestItem.get("id") === idref) {
                    return manifestItem;
                }
            });

        return foundManifestItem;
    },

    getSpineIndex : function (spineItem) {

        return this.spine.indexOf(spineItem);
    },

    // Description: When rendering fixed layout pages we need to determine whether the page
    //   should be on the left or the right in two up mode, options are:
    //     left_page:      render on the left side
    //     right_page:     render on the right side
    //     center_page:    always center the page horizontally
    //   This property must be assigned when the package document is initialized
    // NOTE: Look into how spine items with the linear="no" property affect this algorithm 
    assignPageSpreadClass : function () {

        var that = this;
        var pageSpreadClass;
        var numSpineItems;

        // If the epub is apple fixed layout
        if (this.metadata.get("apple_fixed")) {

            numSpineItems = this.spine.length;
            this.spine.each(function (spineItem, spineIndex) {

                pageSpreadClass = that.pageSpreadProperty.inferiBooksPageSpread(spineIndex, numSpineItems);
                spineItem.set({ pageSpreadClass : pageSpreadClass });
            });
        }
        else {
            // For each spine item
            this.spine.each(function (spineItem, spineIndex) {

                if (spineItem.get("page_spread")) {

                    pageSpreadClass = that.pageSpreadProperty.getPageSpreadFromProperties(spineItem.get("page_spread"));
                    spineItem.set({ pageSpreadClass : pageSpreadClass });
                }
                else {

                    pageSpreadClass = that.pageSpreadProperty.inferUnassignedPageSpread(spineIndex, that.spine, that.pageProgressionDirection());
                    spineItem.set({ pageSpreadClass : pageSpreadClass });
                }
            });
        }
    },

    getTocItem : function() {

        var manifest = this.manifest;
        var metadata = this.metadata;
        var spine_id = this.metadata.get("ncx");

        var item = manifest.find(function(item){

            if (item.get("properties").indexOf("nav") !== -1) {
                return true;
            }
            else {
                return false;
            }
        });

        if( item ) {
            return item;
        }

        if( spine_id && spine_id.length > 0 ) {
            return manifest.find(function(item) {
                return item.get("id") === spine_id;
            });
        }

        return null;
    }

    // NOTE: Media overlays are temporarily disabled
    // getMediaOverlayItem : function(idref) {
    //     // just look up the object in the mo_map
    //     var map = this.get("mo_map");
    //     return map && map[idref];
    // },
});
